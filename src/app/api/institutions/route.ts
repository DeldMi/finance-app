import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';
import { ENTITY_TYPES, type EntityType } from '@/lib/types';

export async function GET() {
  const access = await requireFinancePermission('view');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  try { return NextResponse.json(await db.financialInstitution.findMany({ where: { financeId: access.financeId }, orderBy: { name: 'asc' } })); }
  catch { return NextResponse.json({ error: 'Erro ao carregar contas bancárias.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const access = await requireFinancePermission('create');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const institution = typeof body.institution === 'string' ? body.institution.trim() : '';
  const accountType = typeof body.accountType === 'string' ? body.accountType : 'CHECKING';
  const entity = body.entity;
  const initialBalance = Number(body.initialBalance || 0);
  if (!name || name.length > 60 || !institution || institution.length > 80 || !['CHECKING', 'SAVINGS', 'CASH', 'WALLET', 'OTHER'].includes(accountType) || !ENTITY_TYPES.includes(entity as EntityType) || !Number.isFinite(initialBalance)) return NextResponse.json({ error: 'Confira nome, instituição, tipo, perfil e saldo inicial.' }, { status: 400 });
  if (access.financeEntity !== 'ALL' && entity !== access.financeEntity) return NextResponse.json({ error: 'O perfil da conta deve corresponder à instância financeira.' }, { status: 400 });
  try { return NextResponse.json(await db.financialInstitution.create({ data: { userId, financeId: access.financeId, name, institution, accountType, entity: String(entity), initialBalance } }), { status: 201 }); }
  catch { return NextResponse.json({ error: 'Erro ao cadastrar conta.' }, { status: 500 }); }
}
