import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type Context = { params: { id: string } };

/** Update a card owned by the signed-in account. */
export async function PUT(request: Request, { params }: Context) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const paymentType = data.paymentType === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  const lastFour = typeof data.lastFour === 'string' ? data.lastFour.trim() : '';
  const creditLimit = data.creditLimit === '' || data.creditLimit == null ? null : Number(data.creditLimit);
  const closingDay = data.closingDay === '' || data.closingDay == null ? null : Number(data.closingDay);
  const dueDay = data.dueDay === '' || data.dueDay == null ? null : Number(data.dueDay);

  if (!name || name.length > 60 || (lastFour && !/^\d{4}$/.test(lastFour)) || (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit < 0)) || [closingDay, dueDay].some((day) => day !== null && (!Number.isInteger(day) || day < 1 || day > 31))) {
    return NextResponse.json({ error: 'Confira nome, limite, final do cartão e dias.' }, { status: 400 });
  }

  const card = await prisma.paymentCard.findFirst({ where: { id: params.id, userId: access.userId } });
  if (!card) return NextResponse.json({ error: 'Cartão não encontrado.' }, { status: 404 });

  const updated = await prisma.paymentCard.update({
    where: { id: card.id },
    data: {
      name,
      paymentType,
      brand: typeof data.brand === 'string' ? data.brand.trim().slice(0, 30) || null : null,
      lastFour: lastFour || null,
      creditLimit: paymentType === 'CREDIT' ? creditLimit : null,
      closingDay,
      dueDay,
    },
  });

  return NextResponse.json(updated);
}

/** Remove the card only; linked transactions stay in the user's history. */
export async function DELETE(_request: Request, { params }: Context) {
  const access = await requirePermission('delete');
  if ('response' in access) return access.response;

  const result = await prisma.paymentCard.deleteMany({ where: { id: params.id, userId: access.userId } });
  return result.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Cartão não encontrado.' }, { status: 404 });
}
