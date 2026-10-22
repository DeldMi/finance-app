import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type Context = { params: { id: string; itemId: string } };
const ALLOWED_UNITS = ['un', 'kg', 'g', 'L', 'mL', 'm³'] as const;

function validateItem(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const quantity = Number(data.quantity);
  const unitPrice = Number(data.unitPrice);
  const unit = typeof data.unit === 'string' ? data.unit : '';
  if (!name || name.length > 100 || !Number.isFinite(quantity) || quantity <= 0
    || !Number.isFinite(unitPrice) || unitPrice < 0 || !ALLOWED_UNITS.includes(unit as typeof ALLOWED_UNITS[number])) {
    return null;
  }
  return { name, quantity, unitPrice, unit, checked: data.checked === true };
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const data = validateItem(body);
  if (!data) return NextResponse.json({ error: 'Confira produto, quantidade, unidade e preço.' }, { status: 400 });

  const result = await prisma.shoppingListItem.updateMany({
    where: { id: params.itemId, listId: params.id, list: { userId: access.userId } },
    data,
  });
  if (!result.count) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requirePermission('delete');
  if ('response' in access) return access.response;
  const result = await prisma.shoppingListItem.deleteMany({
    where: { id: params.itemId, listId: params.id, list: { userId: access.userId } },
  });
  if (!result.count) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
