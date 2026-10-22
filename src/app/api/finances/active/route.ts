import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === 'BLOCKED') return NextResponse.json({ error: 'A conta não tem acesso liberado.' }, { status: 403 });
  let body: { financeId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }
  const financeId = typeof body.financeId === 'string' ? body.financeId : '';
  const membership = await prisma.financeMember.findUnique({ where: { financeId_userId: { financeId, userId } } });
  if (!membership) return NextResponse.json({ error: 'Você não tem acesso a esta instância.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('active-finance', financeId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return response;
}
