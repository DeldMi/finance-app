import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function userId() { const session = await getServerSession(authOptions); return session?.user?.id; }
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    return NextResponse.json(await prisma.paymentCard.findMany({ where: { userId: id }, orderBy: { name: 'asc' } }));
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar cartões. Verifique se as migrações do banco foram aplicadas.' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const paymentType = body.paymentType === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  const lastFour = typeof body.lastFour === 'string' ? body.lastFour.trim() : '';
  const limit = body.creditLimit === '' || body.creditLimit == null ? null : Number(body.creditLimit);
  const closingDay = body.closingDay === '' || body.closingDay == null ? null : Number(body.closingDay);
  const dueDay = body.dueDay === '' || body.dueDay == null ? null : Number(body.dueDay);
  if (!name || name.length > 60 || (lastFour && !/^\d{4}$/.test(lastFour)) || (limit !== null && (!Number.isFinite(limit) || limit < 0)) || [closingDay, dueDay].some(day => day !== null && (!Number.isInteger(day) || day < 1 || day > 31))) return NextResponse.json({ error: 'Confira nome, limite, final do cartão e dias.' }, { status: 400 });
  try { return NextResponse.json(await prisma.paymentCard.create({ data: { userId: id, name, paymentType, brand: typeof body.brand === 'string' ? body.brand.trim().slice(0, 30) || null : null, lastFour: lastFour || null, creditLimit: paymentType === 'CREDIT' ? limit : null, closingDay, dueDay } }), { status: 201 }); }
  catch { return NextResponse.json({ error: 'Erro ao cadastrar cartão.' }, { status: 500 }); }
}
