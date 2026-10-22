import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type Context = { params: { id: string } };
const ALLOWED_UNITS = ['un', 'kg', 'g', 'L', 'mL', 'm³'] as const;

function validateItem(data: Record<string, unknown>) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const quantity = Number(data.quantity);
  const unitPrice = Number(data.unitPrice);
  const unit = typeof data.unit === 'string' ? data.unit : '';
  if (!name || name.length > 100 || !Number.isFinite(quantity) || quantity <= 0
    || !Number.isFinite(unitPrice) || unitPrice < 0 || !ALLOWED_UNITS.includes(unit as typeof ALLOWED_UNITS[number])) {
    return null;
  }
  return { name, quantity, unitPrice, unit, checked: data.checked !== false };
}

export async function POST(request: Request, { params }: Context) {
  const access = await requirePermission('create');
  if ('response' in access) return access.response;
  const ownedList = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: access.userId },
    select: { id: true },
  });
  if (!ownedList) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados do item inválidos.' }, { status: 400 });
  }
  const itemData = validateItem(body as Record<string, unknown>);
  if (!itemData) return NextResponse.json({ error: 'Confira produto, quantidade, unidade e preço.' }, { status: 400 });

  const item = await prisma.shoppingListItem.create({
    data: { listId: ownedList.id, ...itemData },
  });
  return NextResponse.json(item, { status: 201 });
}
