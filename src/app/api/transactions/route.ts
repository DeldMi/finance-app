import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ENTITY_TYPES, TRANSACTION_TYPES, type EntityType, type TransactionType } from '@/lib/types';

async function userId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    return NextResponse.json(await prisma.transaction.findMany({ where: { userId: id }, include: { card: true }, orderBy: { date: 'desc' } }));
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar lançamentos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
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
  const cardId = typeof data.cardId === 'string' && data.cardId ? data.cardId : null;
  if (!description || description.length > 120 || !Number.isFinite(amount) || amount <= 0 || category.length > 60 || !TRANSACTION_TYPES.includes(data.type as TransactionType) || !ENTITY_TYPES.includes(data.entity as EntityType) || Number.isNaN(date.getTime()) || (dueDate && Number.isNaN(dueDate.getTime())) || !Number.isInteger(installments) || installments < 1 || installments > 60) {
    return NextResponse.json({ error: 'Confira descrição, valor, datas, tipo, perfil e parcelas.' }, { status: 400 });
  }
  try {
    if (cardId && !await prisma.paymentCard.findFirst({ where: { id: cardId, userId: id } })) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
    const count = recurrence && installments === 1 ? 12 : installments;
    const group = installments > 1 ? crypto.randomUUID() : null;
    const rows = Array.from({ length: count }, (_, index) => {
      const itemDate = new Date(date);
      if (recurrence === 'WEEKLY') itemDate.setDate(itemDate.getDate() + 7 * index);
      else if (recurrence === 'YEARLY') itemDate.setFullYear(itemDate.getFullYear() + index);
      else itemDate.setMonth(itemDate.getMonth() + index);
      const itemDue = dueDate ? new Date(dueDate) : null;
      if (itemDue) {
        if (recurrence === 'WEEKLY') itemDue.setDate(itemDue.getDate() + 7 * index);
        else if (recurrence === 'YEARLY') itemDue.setFullYear(itemDue.getFullYear() + index);
        else itemDue.setMonth(itemDue.getMonth() + index);
      }
      return { userId: id, description: installments > 1 ? `${description} (${index + 1}/${installments})` : description, amount, type: String(data.type), entity: String(data.entity), category, date: itemDate, dueDate: itemDue, status, paidAt: status === 'PAID' ? itemDate : null, recurrence, installmentGroup: group, installmentNumber: installments > 1 ? index + 1 : null, installmentTotal: installments > 1 ? installments : null, cardId };
    });
    await prisma.transaction.createMany({ data: rows });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar lançamento.' }, { status: 500 });
  }
}
