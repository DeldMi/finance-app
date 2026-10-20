import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
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
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hash(password, 12),
      },
      select: { id: true },
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
