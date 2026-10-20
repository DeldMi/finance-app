import { PrismaClient } from '@prisma/client';
import { isAbsolute, resolve } from 'node:path';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL precisa estar configurada para acessar o SQLite.');
  }

  if (!databaseUrl.startsWith('file:')) return databaseUrl;

  const databasePath = databaseUrl.slice('file:'.length);
  if (isAbsolute(databasePath)) return databaseUrl;

  // Prisma CLI resolves this path from prisma/schema.prisma; pin the client to the same directory.
  const absolutePath = resolve(process.cwd(), 'prisma', databasePath);
  return `file:${absolutePath.replace(/\\/g, '/')}`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}