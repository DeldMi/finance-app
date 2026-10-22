import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';

const ALLOWED_PERMISSIONS = ['view', 'create', 'edit', 'delete'] as const;
type Permission = (typeof ALLOWED_PERMISSIONS)[number];

export async function GET() {
  const access = await requireAdmin();
  if ('response' in access) return access.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados de usuário inválidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data.password === 'string' ? data.password : '';

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return NextResponse.json({ error: 'Informe nome, e-mail válido e senha de 8 a 72 bytes.' }, { status: 400 });
  }

  const { hash } = await import('bcryptjs');
  const user = await prisma.user.create({
    data: { name, email, password: await hash(password, 12), role: 'BLOCKED', permissions: '[]' },
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });

  return NextResponse.json(user, { status: 201 });
}
