import { createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 8192) {
      return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const token = typeof data.token === 'string' ? data.token : '';
  const password = typeof data.password === 'string' ? data.password : '';
  const confirmPassword = typeof data.confirmPassword === 'string' ? data.confirmPassword : '';

  if (!token || token.length > 200 || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || password !== confirmPassword) {
    return NextResponse.json({ error: 'Confira o link e informe uma senha de 8 a 72 bytes. As senhas devem ser iguais.' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!checkRateLimit(`reset-token:${tokenHash}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas tentativas. Solicite um novo link de recuperação.' }, { status: 429 });
  }

  try {
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!reset || reset.expiresAt <= new Date()) {
      if (reset) await prisma.passwordResetToken.delete({ where: { id: reset.id } });
      return NextResponse.json({ error: 'Link inválido ou expirado. Solicite uma nova recuperação.' }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const consumed = await prisma.$transaction(async (tx) => {
      const current = await tx.passwordResetToken.findUnique({ where: { id: reset.id } });
      if (!current || current.expiresAt <= new Date()) return false;
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          password: passwordHash,
          failedLoginAttempts: 0,
          loginLockLevel: 0,
          loginLockedUntil: null,
        },
      });
      await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
      return true;
    });

    if (!consumed) {
      return NextResponse.json({ error: 'Link inválido ou expirado. Solicite uma nova recuperação.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Senha redefinida. Você já pode entrar com a nova senha.' });
  } catch (error) {
    console.error('Falha ao redefinir senha:', error);
    return NextResponse.json({ error: 'Não foi possível redefinir a senha agora.' }, { status: 500 });
  }
}
