import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL precisa estar configurada para acessar o SQLite.');
  }

  if (!databaseUrl.startsWith('file:')) return databaseUrl;

  const databasePath = databaseUrl.slice('file:'.length);
  if (isAbsolute(databasePath)) return databaseUrl;

  // Standalone Next.js changes cwd, so locate the schema to match Prisma CLI path resolution.
  let directory = process.cwd();
  if (
    basename(directory) === 'standalone' &&
    basename(dirname(directory)) === '.next'
  ) {
    directory = resolve(directory, '..', '..');
  }

  while (true) {
    const prismaDirectory = resolve(directory, 'prisma');
    if (existsSync(resolve(prismaDirectory, 'schema.prisma'))) {
      const absolutePath = resolve(prismaDirectory, databasePath);
      return `file:${absolutePath.replace(/\\/g, '/')}`;
    }

    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error('Não foi possível localizar prisma/schema.prisma.');
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
