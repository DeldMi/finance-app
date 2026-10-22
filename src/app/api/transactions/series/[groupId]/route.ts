import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ENTITY_TYPES, TRANSACTION_TYPES, type EntityType, type TransactionType } from '@/lib/types';

type Context = { params: { groupId: string } };
async function getUserId() { const session = await getServerSession(authOptions); return session?.user?.id; }

export async function PUT(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const type = body.type;
  const entity = body.entity;
  const cardId = typeof body.cardId === 'string' && body.cardId ? body.cardId : null;
  const accountId = typeof body.accountId === 'string' && body.accountId ? body.accountId : null;
  const purpose = typeof body.purpose === 'string' && ['STANDARD', 'CARD_PAYMENT', 'LOAN', 'DONATION', 'SUBSCRIPTION'].includes(body.purpose) ? body.purpose : 'STANDARD';
  if (!description || description.length > 120 || !Number.isFinite(amount) || amount <= 0 || !category || category.length > 60 || !['PAID', 'PENDING'].includes(String(body.status)) || !TRANSACTION_TYPES.includes(type as TransactionType) || !ENTITY_TYPES.includes(entity as EntityType)) return NextResponse.json({ error: 'Dados da série inválidos.' }, { status: 400 });
  try {
    if (cardId && !await prisma.paymentCard.findFirst({ where: { id: cardId, userId } })) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
    if (accountId && !await prisma.financialInstitution.findFirst({ where: { id: accountId, userId } })) return NextResponse.json({ error: 'Conta bancária inválida.' }, { status: 400 });
    const rows = await prisma.transaction.findMany({ where: { userId, recurrenceGroup: params.groupId }, select: { id: true, date: true, dueDate: true } });
    if (!rows.length) return NextResponse.json({ error: 'Série não encontrada.' }, { status: 404 });
    const today = new Date().toISOString().slice(0, 10);
    const futureIds = rows.filter(row => row.date.toISOString().slice(0, 10) > today || Boolean(row.dueDate && row.dueDate.toISOString().slice(0, 10) > today)).map(row => row.id);
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.updateMany({ where: { userId, recurrenceGroup: params.groupId }, data: { description, amount, category, type: String(type), entity: String(entity), cardId, accountId, purpose, autoDebit: body.autoDebit === true, isSubscription: body.isSubscription === true, notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) || null : null, status: String(body.status), paidAt: body.status === 'PAID' ? new Date() : null } });
      if (body.status === 'PAID' && futureIds.length) await tx.transaction.updateMany({ where: { userId, id: { in: futureIds } }, data: { status: 'PENDING', paidAt: null } });
      return updated;
    });
    return result.count ? NextResponse.json({ success: true, updated: result.count }) : NextResponse.json({ error: 'Série não encontrada.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao atualizar a série.' }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    const result = await prisma.transaction.deleteMany({ where: { userId, recurrenceGroup: params.groupId } });
    return result.count ? NextResponse.json({ success: true, deleted: result.count }) : NextResponse.json({ error: 'Série não encontrada.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao excluir a série.' }, { status: 500 }); }
}
