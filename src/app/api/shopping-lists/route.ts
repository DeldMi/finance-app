import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function GET() {
  const access = await requirePermission('view');
  if ('response' in access) return access.response;

  const lists = await prisma.shoppingList.findMany({
    where: { userId: access.userId },
    include: { items: { orderBy: { createdAt: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(lists);
}

export async function POST(request: Request) {
  const access = await requirePermission('create');
  if ('response' in access) return access.response;

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

  const list = await prisma.shoppingList.create({
    data: { userId: access.userId, name, items: { create: [] } },
    include: { items: true },
  });

  return NextResponse.json(list, { status: 201 });
}
