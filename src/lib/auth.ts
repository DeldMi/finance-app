import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

const FAILED_ATTEMPTS_BEFORE_LOCK = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_LEVEL = 16;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'E-mail e senha',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const ip = getRequestIp(req.headers ?? {});
        if (ip && !checkRateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000)) return null;
        if (!checkRateLimit(`login-account:${email}`, 20, 15 * 60 * 1000)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // Keep timing somewhat consistent and do not disclose whether the account exists.
          await compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const now = new Date();
        if (user.loginLockedUntil && user.loginLockedUntil > now) return null;

        const passwordMatches = await compare(password, user.password);
        if (!passwordMatches) {
          await prisma.$transaction(async (tx) => {
            const latest = await tx.user.findUnique({
              where: { id: user.id },
              select: { failedLoginAttempts: true, loginLockLevel: true, loginLockedUntil: true },
            });
            if (!latest) return;
            if (latest.loginLockedUntil && latest.loginLockedUntil > new Date()) return;

            const attempts = latest.failedLoginAttempts + 1;
            if (attempts >= FAILED_ATTEMPTS_BEFORE_LOCK) {
              const level = Math.min(latest.loginLockLevel + 1, MAX_LOCK_LEVEL);
              const duration = Math.min(BASE_LOCK_MS * (2 ** (level - 1)), MAX_LOCK_MS);
              await tx.user.update({
                where: { id: user.id },
                data: {
                  failedLoginAttempts: 0,
                  loginLockLevel: level,
                  loginLockedUntil: new Date(Date.now() + duration),
                },
              });
            } else {
              await tx.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: attempts },
              });
            }
          });
          return null;
        }

        if (user.role === 'BLOCKED') return null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            loginLockLevel: 0,
            loginLockedUntil: null,
          },
        });

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, token }) {
      if (!session.user || !token.sub) return session;

      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true, permissions: true },
      });

      if (user) {
        session.user.id = token.sub;
        session.user.role = user.role;
        session.user.permissions = user.permissions || '[]';
      }
      return session;
    },
  },
};
