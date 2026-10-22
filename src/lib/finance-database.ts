import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { PrismaClient as FinancePrismaClient } from '@/generated/finance-client';
import { prisma, getDatabaseUrl } from '@/lib/prisma';

const globalForFinanceDatabases = globalThis as typeof globalThis & {
  financeDatabases?: Map<string, FinancePrismaClient>;
  financeDatabaseReady?: Map<string, Promise<FinancePrismaClient>>;
};

const clients = globalForFinanceDatabases.financeDatabases ??= new Map();
const ready = globalForFinanceDatabases.financeDatabaseReady ??= new Map();

function getFinanceDirectory() {
  const configured = process.env.FINANCE_DATABASE_DIR?.trim();
  if (configured) return resolve(configured);
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl.startsWith('file:')) throw new Error('Os bancos financeiros individuais exigem SQLite.');
  const databasePath = databaseUrl.slice('file:'.length).split('?')[0];
  return resolve(dirname(isAbsolute(databasePath) ? databasePath : resolve(process.cwd(), 'prisma', databasePath)), 'user-finances');
}

async function getLegacyFinanceWhere(ownerId: string) {
  const finances = await prisma.finance.findMany({ where: { ownerId }, select: { id: true } });
  return { OR: [{ userId: ownerId }, { financeId: { in: finances.map(({ id }) => id) } }] };
}

async function removeLegacyRows(ownerId: string) {
  const where = await getLegacyFinanceWhere(ownerId);
  await prisma.transaction.deleteMany({ where });
  await prisma.shoppingList.deleteMany({ where });
  await prisma.paymentCard.deleteMany({ where });
  await prisma.financialInstitution.deleteMany({ where });
  await prisma.category.deleteMany({ where });
}

async function ensureFinanceSchema(client: FinancePrismaClient) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS "ShoppingList" ("id" TEXT NOT NULL PRIMARY KEY, "financeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "shareToken" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)',
    'CREATE TABLE IF NOT EXISTS "ShoppingListItem" ("id" TEXT NOT NULL PRIMARY KEY, "listId" TEXT NOT NULL, "name" TEXT NOT NULL, "quantity" REAL NOT NULL, "unit" TEXT NOT NULL DEFAULT \'un\', "unitPrice" REAL NOT NULL, "checked" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE)',
    'CREATE TABLE IF NOT EXISTS "Category" ("id" TEXT NOT NULL PRIMARY KEY, "financeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT \'\', "entity" TEXT NOT NULL DEFAULT \'ALL\', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS "FinancialInstitution" ("id" TEXT NOT NULL PRIMARY KEY, "financeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "institution" TEXT NOT NULL, "accountType" TEXT NOT NULL DEFAULT \'CHECKING\', "entity" TEXT NOT NULL DEFAULT \'PHYSICAL\', "initialBalance" REAL NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS "PaymentCard" ("id" TEXT NOT NULL PRIMARY KEY, "financeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "paymentType" TEXT NOT NULL DEFAULT \'CREDIT\', "brand" TEXT, "lastFour" TEXT, "creditLimit" REAL, "closingDay" INTEGER, "dueDay" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "financeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL DEFAULT \'EXPENSE\', "entity" TEXT NOT NULL DEFAULT \'PHYSICAL\', "category" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "dueDate" DATETIME, "paidAt" DATETIME, "status" TEXT NOT NULL DEFAULT \'PAID\', "recurrence" TEXT, "recurrenceGroup" TEXT, "recurrenceEndDate" DATETIME, "installmentGroup" TEXT, "installmentNumber" INTEGER, "installmentTotal" INTEGER, "cardId" TEXT, "accountId" TEXT, "purpose" TEXT NOT NULL DEFAULT \'STANDARD\', "autoDebit" BOOLEAN NOT NULL DEFAULT false, "isSubscription" BOOLEAN NOT NULL DEFAULT false, "notes" TEXT, FOREIGN KEY ("cardId") REFERENCES "PaymentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE, FOREIGN KEY ("accountId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE)',
    'CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingList_shareToken_key" ON "ShoppingList"("shareToken")',
    'CREATE INDEX IF NOT EXISTS "ShoppingList_financeId_idx" ON "ShoppingList"("financeId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Category_financeId_name_entity_key" ON "Category"("financeId", "name", "entity")',
    'CREATE INDEX IF NOT EXISTS "Category_financeId_idx" ON "Category"("financeId")',
    'CREATE INDEX IF NOT EXISTS "FinancialInstitution_financeId_idx" ON "FinancialInstitution"("financeId")',
    'CREATE INDEX IF NOT EXISTS "PaymentCard_financeId_idx" ON "PaymentCard"("financeId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_financeId_idx" ON "Transaction"("financeId")',
  ];
  for (const statement of statements) await client.$executeRawUnsafe(statement);
}

async function initializeOwnerDatabase(ownerId: string) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(ownerId)) throw new Error('Identificador de usuário inválido.');
  const directory = getFinanceDirectory();
  await mkdir(directory, { recursive: true });
  const filePath = resolve(directory, `${ownerId}.db`);
  const relativeFilePath = relative(directory, filePath);
  if (!relativeFilePath || relativeFilePath.startsWith('..') || isAbsolute(relativeFilePath)) throw new Error('Caminho do banco financeiro inválido.');
  const client = new FinancePrismaClient({ datasources: { db: { url: `file:${filePath.replace(/\\/g, '/')}` } } });

  await ensureFinanceSchema(client);
  await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_FinanceMigration" ("id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1), "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const markers = await client.$queryRawUnsafe<Array<{ id: number }>>('SELECT "id" FROM "_FinanceMigration" WHERE "id" = 1');
  if (markers.length) {
    await removeLegacyRows(ownerId);
    clients.set(ownerId, client);
    return client;
  }

  const legacyWhere = await getLegacyFinanceWhere(ownerId);
  const [transactions, cards, accounts, categories, shoppingLists] = await Promise.all([
    prisma.transaction.findMany({ where: legacyWhere }),
    prisma.paymentCard.findMany({ where: legacyWhere }),
    prisma.financialInstitution.findMany({ where: legacyWhere }),
    prisma.category.findMany({ where: legacyWhere }),
    prisma.shoppingList.findMany({ where: legacyWhere, include: { items: true } }),
  ]);

  await client.$transaction(async (tx) => {
    if (cards.length) await tx.paymentCard.createMany({ data: cards.map((row) => ({ ...row, financeId: row.financeId ?? `legacy-${ownerId}` })) });
    if (accounts.length) await tx.financialInstitution.createMany({ data: accounts.map((row) => ({ ...row, financeId: row.financeId ?? `legacy-${ownerId}` })) });
    if (categories.length) await tx.category.createMany({ data: categories.map((row) => ({ ...row, financeId: row.financeId ?? `legacy-${ownerId}` })) });
    for (const { items, ...list } of shoppingLists) {
      await tx.shoppingList.create({ data: { ...list, financeId: list.financeId ?? `legacy-${ownerId}`, shareToken: list.shareToken ? `${ownerId}.${list.shareToken}` : null, items: { create: items.map(({ id, listId, ...item }) => item) } } });
    }
    if (transactions.length) await tx.transaction.createMany({ data: transactions.map((row) => ({ ...row, financeId: row.financeId ?? `legacy-${ownerId}` })) });
    await tx.$executeRawUnsafe('INSERT INTO "_FinanceMigration" ("id") VALUES (1)');
  });
  await removeLegacyRows(ownerId);
  clients.set(ownerId, client);
  return client;
}

/** Return the physical SQLite database belonging to a finance owner. */
export async function getOwnerFinanceDatabase(ownerId: string): Promise<FinancePrismaClient> {
  const existing = clients.get(ownerId);
  if (existing) return existing;
  let opening = ready.get(ownerId);
  if (!opening) {
    opening = initializeOwnerDatabase(ownerId).catch((error) => {
      const client = clients.get(ownerId);
      clients.delete(ownerId);
      if (client) void client.$disconnect();
      throw error;
    });
    ready.set(ownerId, opening);
  }
  try {
    return await opening;
  } finally {
    ready.delete(ownerId);
  }
}
