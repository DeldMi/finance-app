import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

const allowed = ['view', 'create', 'edit', 'delete'] as const;

async function ownedFinance(id: string, userId: string) {
  return prisma.finance.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission('view');
  if ('response' in access) return access.response;
  if (!await ownedFinance(params.id, access.userId)) return NextResponse.json({ error: 'Somente o dono pode gerenciar os compartilhamentos.' }, { status: 403 });
  const members = await prisma.financeMember.findMany({ where: { financeId: params.id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(members.map(({ user, permissions }) => ({ ...user, permissions: JSON.parse(permissions) as string[] })));
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;
  if (!await ownedFinance(params.id, access.userId)) return NextResponse.json({ error: 'Somente o dono pode compartilhar esta instância.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((item): item is typeof allowed[number] => allowed.includes(item as typeof allowed[number])) : [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !permissions.includes('view')) return NextResponse.json({ error: 'Informe um e-mail cadastrado e conceda a permissão de visualizar.' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!target || target.role === 'BLOCKED') return NextResponse.json({ error: 'Usuário não encontrado ou sem acesso liberado.' }, { status: 404 });
  const finance = await prisma.finance.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  if (!finance || target.id === finance.ownerId) return NextResponse.json({ error: 'O dono já possui acesso total.' }, { status: 400 });
  const membership = await prisma.financeMember.upsert({ where: { financeId_userId: { financeId: params.id, userId: target.id } }, create: { financeId: params.id, userId: target.id, permissions: JSON.stringify(permissions) }, update: { permissions: JSON.stringify(permissions) } });
  return NextResponse.json({ userId: membership.userId, permissions }, { status: 200 });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;
  if (!await ownedFinance(params.id, access.userId)) return NextResponse.json({ error: 'Somente o dono pode remover compartilhamentos.' }, { status: 403 });
  let body: { userId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId || userId === access.userId) return NextResponse.json({ error: 'Não é possível remover o dono da instância.' }, { status: 400 });
  await prisma.financeMember.deleteMany({ where: { financeId: params.id, userId } });
  return NextResponse.json({ ok: true });
}
