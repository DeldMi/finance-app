import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const list = await prisma.shoppingList.findFirst({
    where: { shareToken: params.token },
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
