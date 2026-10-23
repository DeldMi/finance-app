import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

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
        // Only trust client IPs when the deployment explicitly trusts its reverse proxy.
        if (ip && !checkRateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000)) return null;
        // Always throttle by normalized account identifier so spoofed IP headers cannot bypass the limit.
        if (!checkRateLimit(`login-account:${email}`, 8, 15 * 60 * 1000)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await compare(password, user.password))) return null;

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
        // Older or partially migrated user records must not break dashboard rendering.
        session.user.permissions = user.permissions || '[]';
      }
      return session;
    },
  },
};
