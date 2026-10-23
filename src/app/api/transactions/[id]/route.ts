import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('status' in body) || !['PAID', 'PENDING'].includes(String(body.status))) return NextResponse.json({ error: 'Situação inválida.' }, { status: 400 });
  try {
    const status = String(body.status);
    const result = await db.transaction.updateMany({ where: { id: (await params).id, financeId: access.financeId }, data: { status, paidAt: status === 'PAID' ? new Date() : null } });
    return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao atualizar a situação.' }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 }); }
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  const date = new Date(String(body.date));
  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  if (!description || description.length > 120 || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(date.getTime()) || (dueDate && Number.isNaN(dueDate.getTime())) || !['PAID', 'PENDING'].includes(String(body.status))) return NextResponse.json({ error: 'Dados do lançamento inválidos.' }, { status: 400 });
  if (access.financeEntity !== 'ALL' && body.entity !== access.financeEntity) return NextResponse.json({ error: 'O perfil do lançamento deve corresponder à instância financeira.' }, { status: 400 });
  try {
    const existing = await db.transaction.findFirst({ where: { id: (await params).id, financeId: access.financeId } });
    if (!existing) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    const cardId = typeof body.cardId === 'string' && body.cardId ? body.cardId : null;
    const accountId = typeof body.accountId === 'string' && body.accountId ? body.accountId : null;
    if (cardId && !await db.paymentCard.findFirst({ where: { id: cardId, financeId: access.financeId } })) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
    if (accountId && !await db.financialInstitution.findFirst({ where: { id: accountId, financeId: access.financeId } })) return NextResponse.json({ error: 'Conta bancária inválida.' }, { status: 400 });
    const allowedPurposes = ['STANDARD', 'CARD_PAYMENT', 'LOAN', 'DONATION', 'SUBSCRIPTION'];
    const purpose = typeof body.purpose === 'string' && allowedPurposes.includes(body.purpose) ? body.purpose : existing.purpose;
    if (purpose === 'CARD_PAYMENT' && !cardId) return NextResponse.json({ error: 'Selecione o cartão cuja fatura será paga.' }, { status: 400 });
    const transaction = await db.transaction.updateMany({ where: { id: (await params).id, financeId: access.financeId }, data: { description, amount, category: typeof body.category === 'string' ? body.category.trim().slice(0, 60) || 'Geral' : existing.category, date, dueDate, status: String(body.status), paidAt: body.status === 'PAID' ? new Date() : null, cardId, accountId, purpose, autoDebit: body.autoDebit === true, isSubscription: body.isSubscription === true, notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) || null : null } });
    return transaction.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao atualizar lançamento.' }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireFinancePermission('delete');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  try {
    const result = await db.transaction.deleteMany({ where: { id: (await params).id, financeId: access.financeId } });
    return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao excluir lançamento.' }, { status: 500 }); }
}
