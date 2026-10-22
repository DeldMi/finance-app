import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getUserId() { const session = await getServerSession(authOptions); return session?.user?.id; }

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const requestedEntity = new URL(request.url).searchParams.get('entity');
  const entityFilter = requestedEntity === 'PHYSICAL' || requestedEntity === 'LEGAL' ? { OR: [{ entity: 'ALL' }, { entity: requestedEntity }] } : {};
  try { return NextResponse.json(await prisma.category.findMany({ where: { userId, ...entityFilter }, orderBy: { name: 'asc' } })); }
  catch { return NextResponse.json({ error: 'Erro ao carregar categorias.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const entity = typeof body.entity === 'string' && ['ALL', 'PHYSICAL', 'LEGAL'].includes(body.entity) ? body.entity : 'ALL';
  if (!name || name.length > 60 || description.length > 180) return NextResponse.json({ error: 'Informe um nome (até 60 caracteres) e descrição (até 180).' }, { status: 400 });
  try {
    const existing = await prisma.category.findMany({ where: { userId, entity } });
    if (existing.some(item => item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return NextResponse.json({ error: 'Já existe uma categoria com esse nome neste perfil.' }, { status: 409 });
    return NextResponse.json(await prisma.category.create({ data: { userId, name, description, entity } }), { status: 201 });
  }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 });
    return NextResponse.json({ error: 'Erro ao criar categoria.' }, { status: 500 });
  }
}
