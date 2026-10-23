import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePermissions, requireFinancePermission } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';

const tables = ['transactions', 'cards', 'accounts', 'categories', 'shoppingLists'] as const;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_ROWS_PER_TABLE = 5000;
const allowedFields: Record<(typeof tables)[number], Set<string>> = {
  transactions: new Set(['id', 'description', 'amount', 'type', 'entity', 'category', 'date', 'createdAt', 'dueDate', 'paidAt', 'status', 'recurrence', 'recurrenceGroup', 'recurrenceEndDate', 'installmentGroup', 'installmentNumber', 'installmentTotal', 'cardId', 'accountId', 'purpose', 'autoDebit', 'isSubscription', 'notes', 'financeId', 'userId']),
  cards: new Set(['id', 'name', 'paymentType', 'brand', 'lastFour', 'creditLimit', 'closingDay', 'dueDay', 'createdAt', 'financeId', 'userId']),
  accounts: new Set(['id', 'name', 'institution', 'accountType', 'entity', 'initialBalance', 'createdAt', 'financeId', 'userId']),
  categories: new Set(['id', 'name', 'description', 'entity', 'createdAt', 'financeId', 'userId']),
  shoppingLists: new Set(['id', 'name', 'shareToken', 'createdAt', 'updatedAt', 'financeId', 'userId', 'items']),
};

async function readLimitedJson(request: Request): Promise<any> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');
  if (!request.body) throw new Error('INVALID_JSON');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BACKUP_BYTES) {
        await reader.cancel();
        throw new Error('BACKUP_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function validateRows(data: any, selected: readonly (typeof tables)[number][]) {
  let total = 0;
  for (const key of selected) {
    const rows = data[key];
    if (!Array.isArray(rows)) throw new Error(`INVALID_${key}`);
    if (rows.length > MAX_ROWS_PER_TABLE) throw new Error('TOO_MANY_ROWS');
    total += rows.length;
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`INVALID_${key}`);
      if (Object.keys(row).some((field) => !allowedFields[key].has(field))) throw new Error(`INVALID_${key}`);
      if (key === 'shoppingLists') {
        if (row.items !== undefined && (!Array.isArray(row.items) || row.items.length > MAX_ROWS_PER_TABLE)) throw new Error('INVALID_shoppingLists');
        for (const item of row.items || []) {
          if (!item || typeof item !== 'object' || Array.isArray(item) ||
            Object.keys(item).some((field) => !['id', 'listId', 'name', 'quantity', 'unit', 'unitPrice', 'checked', 'createdAt', 'updatedAt'].includes(field)) ||
            typeof item.name !== 'string' || !Number.isFinite(item.quantity) || !Number.isFinite(item.unitPrice)) {
            throw new Error('INVALID_shoppingLists');
          }
        }
      }
      if (key === 'transactions' && (typeof row.description !== 'string' || !Number.isFinite(row.amount) || typeof row.category !== 'string')) throw new Error('INVALID_transactions');
      if (key === 'cards' && typeof row.name !== 'string') throw new Error('INVALID_cards');
      if (key === 'accounts' && (typeof row.name !== 'string' || typeof row.institution !== 'string' || !Number.isFinite(row.initialBalance ?? 0))) throw new Error('INVALID_accounts');
      if (key === 'categories' && typeof row.name !== 'string') throw new Error('INVALID_categories');
    }
  }
  if (total > MAX_ROWS_PER_TABLE * tables.length) throw new Error('TOO_MANY_ROWS');
}

function validationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'BACKUP_TOO_LARGE') return NextResponse.json({ error: 'O backup excede o limite de 10 MB.' }, { status: 413 });
  if (message === 'TOO_MANY_ROWS') return NextResponse.json({ error: 'O backup excede o limite de registros permitido.' }, { status: 413 });
  if (message === 'INVALID_JSON') return NextResponse.json({ error: 'O conteúdo enviado não é um JSON válido.' }, { status: 400 });
  if (message.startsWith('INVALID_')) return NextResponse.json({ error: 'O backup contém registros inválidos ou campos não permitidos.' }, { status: 400 });
  return null;
}

export async function PUT(request: NextRequest) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  if (access.role !== 'ADMIN') return NextResponse.json({ error: 'Somente administradores podem gravar em caminhos do servidor.' }, { status: 403 });
  try {
    const body = await readLimitedJson(request);
    const directory = typeof body?.directory === 'string' ? body.directory.trim() : '';
    if (!directory || directory.length > 500 || !path.isAbsolute(directory)) {
      return NextResponse.json({ error: 'Informe um caminho absoluto válido, como /bkp.' }, { status: 400 });
    }
    if (body?.snapshot?.version !== 1 || !body.snapshot.data || typeof body.snapshot.data !== 'object') {
      return NextResponse.json({ error: 'Os dados do backup estão inválidos.' }, { status: 400 });
    }
    const selected = tables.filter((key) => Array.isArray(body.snapshot.data[key]));
    validateRows(body.snapshot.data, selected);
    const retention = Math.max(1, Math.min(100, Number.parseInt(String(body.retention), 10) || 5));
    const target = path.resolve(directory);
    await mkdir(target, { recursive: true });
    if (!(await stat(target)).isDirectory()) return NextResponse.json({ error: 'O caminho informado não é uma pasta.' }, { status: 400 });
    const prefix = `meu-financeiro-${access.financeId}-`;
    const fileName = `${prefix}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await writeFile(path.join(target, fileName), JSON.stringify(body.snapshot, null, 2), { flag: 'wx', mode: 0o600 });
    const files = (await readdir(target, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    await Promise.all(files.slice(retention).map((name) => unlink(path.join(target, name))));
    return NextResponse.json({ ok: true, fileName, directory: target });
  } catch (error) {
    const invalid = validationError(error);
    if (invalid) return invalid;
    return NextResponse.json({ error: 'Não foi possível gravar nesse caminho. Confira se a pasta existe e se o app tem permissão de escrita.' }, { status: 400 });
  }
}

export async function GET() {
  const access = await requireFinancePermission('view');
  if ('response' in access) return access.response;
  // A view grant must not automatically grant bulk export of sensitive financial records.
  const finance = await prisma.finance.findUnique({ where: { id: access.financeId }, select: { ownerId: true, name: true, entity: true } });
  if (!finance || (finance.ownerId !== access.userId && access.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Somente o proprietário ou um administrador pode exportar backups.' }, { status: 403 });
  }
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const [transactions, cards, accounts, categories, shoppingLists] = await Promise.all([
    db.transaction.findMany({ where: { financeId: access.financeId } }),
    db.paymentCard.findMany({ where: { financeId: access.financeId } }),
    db.financialInstitution.findMany({ where: { financeId: access.financeId } }),
    db.category.findMany({ where: { financeId: access.financeId } }),
    db.shoppingList.findMany({ where: { financeId: access.financeId }, include: { items: true } }),
  ]);
  return NextResponse.json({ version: 1, createdAt: new Date().toISOString(), finance: { name: finance.name, entity: finance.entity }, data: { transactions, cards, accounts, categories, shoppingLists } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === 'BLOCKED') return NextResponse.json({ error: 'A conta não tem acesso liberado.' }, { status: 403 });

  let financeId = request.cookies.get('active-finance')?.value || '';
  let financeOwnerId = userId;
  let createdFinanceId: string | null = null;
  try {
    const body = await readLimitedJson(request);
    if (body?.version !== 1 || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return NextResponse.json({ error: 'Arquivo de backup inválido ou incompatível.' }, { status: 400 });
    const selected: (typeof tables)[number][] = Array.isArray(body.selected) ? [...new Set(body.selected.filter((key: unknown): key is (typeof tables)[number] => typeof key === 'string' && tables.includes(key as (typeof tables)[number]))] : [];
    if (!selected.length) return NextResponse.json({ error: 'Selecione ao menos um tipo de dado para restaurar.' }, { status: 400 });
    validateRows(body.data, selected);

    if (financeId) {
      const membership = await prisma.financeMember.findUnique({ where: { financeId_userId: { financeId, userId } }, include: { finance: { select: { ownerId: true } } } });
      if (!membership) return NextResponse.json({ error: 'Sem acesso a esta instância financeira.' }, { status: 403 });
      if (membership.finance.ownerId !== userId && user.role !== 'ADMIN') return NextResponse.json({ error: 'Somente o proprietário ou um administrador pode restaurar um backup.' }, { status: 403 });
      if (!parsePermissions(membership.permissions).includes('edit') && user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão para restaurar nesta instância.' }, { status: 403 });
      financeOwnerId = membership.finance.ownerId;
    } else {
      const memberships = await prisma.financeMember.count({ where: { userId } });
      if (memberships) return NextResponse.json({ error: 'Selecione a instância financeira que receberá o backup.' }, { status: 400 });
      if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Somente um administrador pode criar uma instância a partir de um backup.' }, { status: 403 });
      const backupFinance = body.finance && typeof body.finance === 'object' ? body.finance : {};
      const name = typeof backupFinance.name === 'string' ? backupFinance.name.trim().slice(0, 80) : '';
      const rows = tables.flatMap((key) => Array.isArray(body.data[key]) ? body.data[key] : []);
      const entity = backupFinance.entity === 'LEGAL' || backupFinance.entity === 'PHYSICAL'
        ? backupFinance.entity
        : rows.some((row: any) => row?.entity === 'LEGAL') ? 'LEGAL' : 'PHYSICAL';
      const finance = await prisma.finance.create({
        data: {
          name: name || 'Instancia restaurada',
          entity,
          ownerId: userId,
          members: { create: { userId, permissions: '["view","create","edit","delete"]' } },
        },
      });
      financeId = finance.id;
      financeOwnerId = userId;
      createdFinanceId = finance.id;
    }

    const db = await getOwnerFinanceDatabase(financeOwnerId);
    await db.$transaction(async (tx) => {
      if (selected.includes('transactions')) await tx.transaction.deleteMany({ where: { financeId } });
      if (selected.includes('shoppingLists')) await tx.shoppingList.deleteMany({ where: { financeId } });
      if (selected.includes('cards')) await tx.paymentCard.deleteMany({ where: { financeId } });
      if (selected.includes('accounts')) await tx.financialInstitution.deleteMany({ where: { financeId } });
      if (selected.includes('categories')) await tx.category.deleteMany({ where: { financeId } });
      if (selected.includes('cards')) for (const row of body.data.cards) await tx.paymentCard.create({ data: { ...row, userId, financeId } });
      if (selected.includes('accounts')) for (const row of body.data.accounts) await tx.financialInstitution.create({ data: { ...row, userId, financeId } });
      if (selected.includes('categories')) for (const row of body.data.categories) await tx.category.create({ data: { ...row, userId, financeId } });
      if (selected.includes('transactions')) for (const row of body.data.transactions) await tx.transaction.create({ data: { ...row, userId, financeId } });
      if (selected.includes('shoppingLists')) for (const row of body.data.shoppingLists) {
        const { items, ...list } = row;
        await tx.shoppingList.create({ data: { ...list, userId, financeId, items: { create: (items || []).map(({ id, listId, ...item }: any) => item) } } });
      }
    });
    const response = NextResponse.json({ ok: true, financeId, financeCreated: Boolean(createdFinanceId) });
    response.cookies.set('active-finance', financeId, { httpOnly: true, sameSite: 'lax', secure: process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.startsWith('https://') : process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    if (createdFinanceId) await prisma.finance.delete({ where: { id: createdFinanceId } }).catch(() => undefined);
    const invalid = validationError(error);
    if (invalid) return invalid;
    return NextResponse.json({ error: 'Não foi possível restaurar. Confira o arquivo e as relações entre os dados.' }, { status: 400 });
  }
}
