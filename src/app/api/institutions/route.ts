import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { ENTITY_TYPES, type EntityType } from '@/lib/types';

export async function GET() {
  const access = await requirePermission('view');
  if ('response' in access) return access.response;
  const userId = access.userId;
  try { return NextResponse.json(await prisma.financialInstitution.findMany({ where: { userId }, orderBy: { name: 'asc' } })); }
  catch { return NextResponse.json({ error: 'Erro ao carregar contas bancárias.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const access = await requirePermission('create');
  if ('response' in access) return access.response;
  const userId = access.userId;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const institution = typeof body.institution === 'string' ? body.institution.trim() : '';
  const accountType = typeof body.accountType === 'string' ? body.accountType : 'CHECKING';
  const entity = body.entity;
  const initialBalance = Number(body.initialBalance || 0);
  if (!name || name.length > 60 || !institution || institution.length > 80 || !['CHECKING', 'SAVINGS', 'CASH', 'WALLET', 'OTHER'].includes(accountType) || !ENTITY_TYPES.includes(entity as EntityType) || !Number.isFinite(initialBalance)) return NextResponse.json({ error: 'Confira nome, instituição, tipo, perfil e saldo inicial.' }, { status: 400 });
  try { return NextResponse.json(await prisma.financialInstitution.create({ data: { userId, name, institution, accountType, entity: String(entity), initialBalance } }), { status: 201 }); }
  catch { return NextResponse.json({ error: 'Erro ao cadastrar conta.' }, { status: 500 }); }
}
