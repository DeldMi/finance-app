import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { ENTITY_TYPES, type EntityType } from '@/lib/types';

type Context = { params: { id: string } };
const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'WALLET', 'OTHER'];

/** Update a bank account or cash wallet owned by the current user. */
export async function PUT(request: Request, { params }: Context) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;

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

  const account = await prisma.financialInstitution.findFirst({ where: { id: params.id, userId: access.userId } });
  if (!account) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });

  const updated = await prisma.financialInstitution.update({
    where: { id: account.id },
    data: { name, institution, accountType, entity: String(entity), initialBalance },
  });
  return NextResponse.json(updated);
}

/** Remove the account; historical transactions remain saved. */
export async function DELETE(_request: Request, { params }: Context) {
  const access = await requirePermission('delete');
  if ('response' in access) return access.response;

  const result = await prisma.financialInstitution.deleteMany({ where: { id: params.id, userId: access.userId } });
  return result.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
}
