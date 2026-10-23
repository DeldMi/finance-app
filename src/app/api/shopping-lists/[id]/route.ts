import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados da lista inválidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 60 || typeof data.shareEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Informe o nome e o estado de compartilhamento.' }, { status: 400 });
  }

  const current = await db.shoppingList.findFirst({
    where: { id: (await params).id, financeId: access.financeId },
  });
  if (!current) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });

  const list = await db.shoppingList.update({
    where: { id: current.id },
    data: {
      name,
      shareToken: data.shareEnabled
        ? current.shareToken || `${access.financeOwnerId}.${randomBytes(32).toString('hex')}`
        : null,
    },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json(list);
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireFinancePermission('delete');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);

  const result = await db.shoppingList.deleteMany({
    where: { id: (await params).id, financeId: access.financeId },
  });
  if (!result.count) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });

  return NextResponse.json({ success: true });
}
