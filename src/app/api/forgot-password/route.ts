import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

const GENERIC_MESSAGE = 'Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.';

export async function POST(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = process.env.TRUST_PROXY_HEADERS === 'true'
    ? forwarded?.split(',')[0]?.trim()
    : null;
  if (ip && !checkRateLimit(`forgot-ip:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 4096) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  const email = body && typeof body === 'object' && 'email' in body && typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  // Fail closed if email delivery is not configured; never log or return reset tokens.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.NEXTAUTH_URL) {
    console.error('Recuperação de senha indisponível: configure RESEND_API_KEY, RESEND_FROM_EMAIL e NEXTAUTH_URL.');
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
      ]);

      const resetUrl = new URL('/reset-password', process.env.NEXTAUTH_URL);
      resetUrl.searchParams.set('token', rawToken);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [user.email],
          subject: 'Recuperação de senha — Meu Financeiro',
          text: `Recebemos uma solicitação para redefinir sua senha. Este link expira em 30 minutos e só pode ser usado uma vez:\n\n${resetUrl.toString()}\n\nSe você não solicitou a recuperação, ignore este e-mail.`,
        }),
      });
      if (!response.ok) {
        await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
        console.error('Falha no envio de e-mail de recuperação. Código HTTP:', response.status);
      }
    }
  } catch (error) {
    console.error('Falha no fluxo de recuperação de senha:', error);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
}
