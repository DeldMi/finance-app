import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';
import { ENTITY_TYPES, type EntityType } from '@/lib/types';

type Context = { params: { id: string } };
const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'WALLET', 'OTHER'];

/** Update a bank account or cash wallet owned by the current user. */
export async function PUT(request: Request, { params }: Context) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const institution = typeof data.institution === 'string' ? data.institution.trim() : '';
  const accountType = typeof data.accountType === 'string' ? data.accountType : 'CHECKING';
  const initialBalance = Number(data.initialBalance);
  const entity = data.entity;
  if (!name || name.length > 60 || !institution || institution.length > 80 || !ACCOUNT_TYPES.includes(accountType) || !ENTITY_TYPES.includes(entity as EntityType) || !Number.isFinite(initialBalance)) {
    return NextResponse.json({ error: 'Confira nome, instituição, tipo, perfil e saldo inicial.' }, { status: 400 });
  }

  const account = await db.financialInstitution.findFirst({ where: { id: params.id, financeId: access.financeId } });
  if (!account) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

  const updated = await db.financialInstitution.update({
    where: { id: account.id },
    data: { name, institution, accountType, entity: String(entity), initialBalance },
  });
  return NextResponse.json(updated);
}

/** Remove the account; historical transactions remain saved. */
export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireFinancePermission('delete');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  const result = await db.financialInstitution.deleteMany({ where: { id: params.id, financeId: access.financeId } });
  return result.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
}
