import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = getRequestIp(request.headers);
  // Enforce per-IP throttling only when the deployment has explicitly configured a trusted proxy.
  // If no trusted client IP is available, the reverse proxy/API gateway must enforce this limit.
  if (ip && !checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' }, { status: 429 });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 16 * 1024) {
      return NextResponse.json({ error: 'A requisição excede o limite permitido.' }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados de cadastro inválidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (
    !name ||
    name.length > 100 ||
    !validEmail ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return NextResponse.json(
      { error: 'Informe nome e e-mail válidos e senha de 8 a 72 bytes.' },
      { status: 400 },
    );
  }

  try {
    // The first account owns the workspace; later accounts start without access.
    const user = await prisma.$transaction(async (tx) => {
      const firstAccount = (await tx.user.count()) === 0;
      return tx.user.create({
        data: {
          name,
          email,
          password: await hash(password, 12),
          role: firstAccount ? 'ADMIN' : 'BLOCKED',
          permissions: firstAccount
            ? JSON.stringify(['view', 'create', 'edit', 'delete'])
            : '[]',
        },
        select: { id: true },
      });
    });
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Já existe uma conta cadastrada com este e-mail.' },
        { status: 409 },
      );
    }
    console.error('Falha ao criar conta:', error);
    return NextResponse.json({ error: 'Não foi possível criar sua conta.' }, { status: 500 });
  }
}
