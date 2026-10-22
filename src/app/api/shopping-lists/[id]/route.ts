import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

type Context = { params: { id: string } };

export async function PUT(request: Request, { params }: Context) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;

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

  const current = await prisma.shoppingList.findFirst({
    where: { id: params.id, userId: access.userId },
  });
  if (!current) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });

  const list = await prisma.shoppingList.update({
    where: { id: current.id },
    data: {
      name,
      shareToken: data.shareEnabled
        ? current.shareToken || randomBytes(32).toString('hex')
        : null,
    },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json(list);
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requirePermission('delete');
  if ('response' in access) return access.response;

  const result = await prisma.shoppingList.deleteMany({
    where: { id: params.id, userId: access.userId },
  });
  if (!result.count) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 });

  return NextResponse.json({ success: true });
}
