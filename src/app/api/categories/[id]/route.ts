import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { requireFinancePermission } from '@/lib/permissions';

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const entity = typeof body.entity === 'string' && ['ALL', 'PHYSICAL', 'LEGAL'].includes(body.entity) ? body.entity : 'ALL';
  if (!name || name.length > 60 || description.length > 180) return NextResponse.json({ error: 'Informe um nome (até 60 caracteres) e descrição (até 180).' }, { status: 400 });
  try {
    const previous = await db.category.findFirst({ where: { id: (await params).id, financeId: access.financeId } });
    if (!previous) return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
    const existingCategories = await db.category.findMany({ where: { financeId: access.financeId, entity } });
    if (existingCategories.some(item => item.id !== previous.id && item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return NextResponse.json({ error: 'Já existe uma categoria com esse nome neste perfil.' }, { status: 409 });
    const category = await db.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id: previous.id }, data: { name, description, entity } });
      if (previous.name !== name) await tx.transaction.updateMany({ where: { financeId: access.financeId, category: previous.name }, data: { category: name } });
      return updated;
    });
    return NextResponse.json(category);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 });
    return NextResponse.json({ error: 'Erro ao atualizar categoria.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireFinancePermission('delete');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const userId = access.userId;
  try {
    const result = await db.category.deleteMany({ where: { id: (await params).id, financeId: access.financeId } });
    return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao excluir categoria.' }, { status: 500 }); }
}
