import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';

export async function GET() {
  const access = await requireFinancePermission('view');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  const lists = await db.shoppingList.findMany({
    where: { financeId: access.financeId },
    include: { items: { orderBy: { createdAt: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(lists);
}

export async function POST(request: Request) {
  const access = await requireFinancePermission('create');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const name = body && typeof body === 'object' && 'name' in body
    && typeof body.name === 'string'
    ? body.name.trim()
    : '';

  if (!name || name.length > 60) {
    return NextResponse.json({ error: 'Informe um nome de até 60 caracteres.' }, { status: 400 });
  }

  const list = await db.shoppingList.create({
    data: { userId: access.userId, financeId: access.financeId, name, items: { create: [] } },
    include: { items: true },
  });

  return NextResponse.json(list, { status: 201 });
}
