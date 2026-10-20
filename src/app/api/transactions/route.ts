import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ENTITY_TYPES,
  TRANSACTION_TYPES,
  type EntityType,
  type TransactionType,
} from '@/lib/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Falha ao buscar transações:', error);
    return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados da transação inválidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const description =
    typeof data.description === 'string' ? data.description.trim() : '';
  const amount = Number(data.amount);
  const type = data.type;
  const entity = data.entity;
  const category =
    typeof data.category === 'string' && data.category.trim()
      ? data.category.trim()
      : 'Geral';

  if (
    !description ||
    description.length > 120 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    category.length > 60 ||
    typeof type !== 'string' ||
    !TRANSACTION_TYPES.includes(type as TransactionType) ||
    typeof entity !== 'string' ||
    !ENTITY_TYPES.includes(entity as EntityType)
  ) {
    return NextResponse.json(
      { error: 'Informe uma descrição, valor positivo, tipo e perfil válidos.' },
      { status: 400 },
    );
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount,
        type,
        entity,
        category,
        userId: session.user.id,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Falha ao salvar transação:', error);
    return NextResponse.json({ error: 'Erro ao salvar transação' }, { status: 500 });
  }
}