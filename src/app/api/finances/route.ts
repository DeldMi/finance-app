import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function authenticatedUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { response: NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 }) };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === 'BLOCKED') return { response: NextResponse.json({ error: 'A conta não tem acesso liberado.' }, { status: 403 }) };
  return { userId };
}

export async function GET() {
  const access = await authenticatedUser();
  if ('response' in access) return access.response;
  const memberships = await prisma.financeMember.findMany({
    where: { userId: access.userId },
    include: { finance: { select: { id: true, name: true, entity: true, ownerId: true, owner: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(memberships.map(({ finance, permissions }) => ({ ...finance, permissions: JSON.parse(permissions) as string[] })));
}

export async function POST(request: NextRequest) {
  const access = await authenticatedUser();
  if ('response' in access) return access.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const entity = body.entity === 'LEGAL' ? 'LEGAL' : body.entity === 'PHYSICAL' ? 'PHYSICAL' : '';
  if (!name || !entity) return NextResponse.json({ error: 'Informe o nome e escolha PF ou PJ.' }, { status: 400 });
  const finance = await prisma.finance.create({ data: { name, entity, ownerId: access.userId, members: { create: { userId: access.userId, permissions: '["view","create","edit","delete"]' } } } });
  return NextResponse.json({ ...finance, permissions: ['view', 'create', 'edit', 'delete'] }, { status: 201 });
}
