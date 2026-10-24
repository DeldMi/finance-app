import { NextResponse } from 'next/server';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const separator = (await params).token.indexOf('.');
  if (separator <= 0) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 });
  const ownerId = (await params).token.slice(0, separator);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(ownerId)) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 });
  const owner = await prisma.finance.findFirst({ where: { ownerId }, select: { id: true } });
  if (!owner) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 });
  const db = await getOwnerFinanceDatabase(ownerId);
  const list = await db.shoppingList.findFirst({
    where: { shareToken: (await params).token },
    select: {
      name: true,
      updatedAt: true,
      items: {
        select: { name: true, quantity: true, unit: true, unitPrice: true, checked: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!list) return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 });
  return NextResponse.json(list, { headers: { 'Cache-Control': 'no-store' } });
}
