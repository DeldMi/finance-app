import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { ENTITY_TYPES, TRANSACTION_TYPES, type EntityType, type TransactionType } from '@/lib/types';

function addRecurrence(date: Date, recurrence: string, occurrence: number): Date {
  const result = new Date(date);
  if (recurrence === 'WEEKLY') {
    result.setDate(result.getDate() + 7 * occurrence);
    return result;
  }
  if (recurrence === 'MONTHLY') {
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + occurrence);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
  }
  const day = result.getDate();
  const month = result.getMonth();
  result.setDate(1);
  result.setFullYear(result.getFullYear() + occurrence);
  result.setMonth(month);
  result.setDate(Math.min(day, new Date(result.getFullYear(), month + 1, 0).getDate()));
  return result;
}

export async function GET() {
  const access = await requirePermission('view');
  if ('response' in access) return access.response;
  const id = access.userId;
  try {
    return NextResponse.json(await prisma.transaction.findMany({ where: { userId: id }, include: { card: true }, orderBy: { date: 'desc' } }));
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar lançamentos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requirePermission('create');
  if ('response' in access) return access.response;
  const id = access.userId;
  let data: Record<string, unknown>;
  try { data = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 }); }
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const amount = Number(data.amount);
  const category = typeof data.category === 'string' && data.category.trim() ? data.category.trim() : 'Geral';
  const date = data.date ? new Date(String(data.date)) : new Date();
  const dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
  const status = data.status === 'PENDING' ? 'PENDING' : 'PAID';
  const installments = Number(data.installments || 1);
  const recurrence = Number(data.installments || 1) === 1 && typeof data.recurrence === 'string' && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(data.recurrence) ? data.recurrence : null;
  const recurrenceEndDate = data.recurrenceEndDate ? new Date(String(data.recurrenceEndDate)) : null;
  const cardId = typeof data.cardId === 'string' && data.cardId ? data.cardId : null;
  const accountId = typeof data.accountId === 'string' && data.accountId ? data.accountId : null;
  const purpose = typeof data.purpose === 'string' && ['STANDARD', 'CARD_PAYMENT', 'LOAN', 'DONATION', 'SUBSCRIPTION'].includes(data.purpose) ? data.purpose : 'STANDARD';
  const autoDebit = data.autoDebit === true;
  const isSubscription = data.isSubscription === true || purpose === 'SUBSCRIPTION';
  if (!description || description.length > 120 || !Number.isFinite(amount) || amount <= 0 || category.length > 60 || !TRANSACTION_TYPES.includes(data.type as TransactionType) || !ENTITY_TYPES.includes(data.entity as EntityType) || Number.isNaN(date.getTime()) || (dueDate && Number.isNaN(dueDate.getTime())) || !Number.isInteger(installments) || installments < 1 || installments > 60 || (recurrence && (!recurrenceEndDate || Number.isNaN(recurrenceEndDate.getTime()) || recurrenceEndDate < date))) {
    return NextResponse.json({ error: 'Confira descrição, valor, datas, tipo, perfil e parcelas.' }, { status: 400 });
  }
  try {
    if (cardId && !await prisma.paymentCard.findFirst({ where: { id: cardId, userId: id } })) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
    const card = cardId ? await prisma.paymentCard.findFirst({ where: { id: cardId, userId: id } }) : null;
    if (accountId && !await prisma.financialInstitution.findFirst({ where: { id: accountId, userId: id } })) return NextResponse.json({ error: 'Conta bancária inválida.' }, { status: 400 });
    if (purpose === 'CARD_PAYMENT' && !cardId) return NextResponse.json({ error: 'Selecione o cartão cuja fatura será paga.' }, { status: 400 });
    if (autoDebit && !accountId && !cardId) return NextResponse.json({ error: 'Selecione a conta ou o cartão do débito automático.' }, { status: 400 });
    if (purpose === 'CARD_PAYMENT' && card?.paymentType !== 'CREDIT') return NextResponse.json({ error: 'A fatura só pode ser paga para cartão de crédito.' }, { status: 400 });
    const linkedAccountId = card?.paymentType === 'CREDIT' && purpose !== 'CARD_PAYMENT' ? null : accountId;
    let count = installments;
    if (recurrence && recurrenceEndDate) {
      count = 0;
      while (addRecurrence(date, recurrence, count) <= recurrenceEndDate && count < 600) {
        count += 1;
      }
      if (count === 600 && addRecurrence(date, recurrence, count) <= recurrenceEndDate) return NextResponse.json({ error: 'A repetição pode gerar no máximo 600 ocorrências.' }, { status: 400 });
    }
    const group = installments > 1 ? crypto.randomUUID() : null;
    const recurrenceGroup = recurrence ? crypto.randomUUID() : null;
    const rows = Array.from({ length: count }, (_, index) => {
      const itemDate = recurrence ? addRecurrence(date, recurrence, index) : new Date(date);
      const itemDue = dueDate ? recurrence ? addRecurrence(dueDate, recurrence, index) : new Date(dueDate) : null;
      const today = new Date().toISOString().slice(0, 10);
      const isFuture = itemDate.toISOString().slice(0, 10) > today || Boolean(itemDue && itemDue.toISOString().slice(0, 10) > today);
      const isCreditCharge = purpose !== 'CARD_PAYMENT' && data.type === 'EXPENSE' && card?.paymentType === 'CREDIT';
      const itemStatus = isFuture || isCreditCharge ? 'PENDING' : status;
      return { userId: id, description: installments > 1 ? `${description} (${index + 1}/${installments})` : description, amount, type: String(data.type), entity: String(data.entity), category, date: itemDate, dueDate: itemDue, status: itemStatus, paidAt: itemStatus === 'PAID' ? itemDate : null, recurrence, recurrenceGroup, recurrenceEndDate, installmentGroup: group, installmentNumber: installments > 1 ? index + 1 : null, installmentTotal: installments > 1 ? installments : null, cardId, accountId: linkedAccountId, purpose, autoDebit, isSubscription, notes: typeof data.notes === 'string' ? data.notes.trim().slice(0, 300) || null : null };
    });
    await prisma.transaction.createMany({ data: rows });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar lançamento.' }, { status: 500 });
  }
}
