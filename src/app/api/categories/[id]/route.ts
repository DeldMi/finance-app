import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: { id: string } };
async function getUserId() { const session = await getServerSession(authOptions); return session?.user?.id; }

export async function PUT(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!name || name.length > 60 || description.length > 180) return NextResponse.json({ error: 'Informe um nome (até 60 caracteres) e descrição (até 180).' }, { status: 400 });
  try {
    const previous = await prisma.category.findFirst({ where: { id: params.id, userId } });
    if (!previous) return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id: previous.id }, data: { name, description } });
      if (previous.name !== name) await tx.transaction.updateMany({ where: { userId, category: previous.name }, data: { category: name } });
      return updated;
    });
    return NextResponse.json(category);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 });
    return NextResponse.json({ error: 'Erro ao atualizar categoria.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    const result = await prisma.category.deleteMany({ where: { id: params.id, userId } });
    return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Erro ao excluir categoria.' }, { status: 500 }); }
}
