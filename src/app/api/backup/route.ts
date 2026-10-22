import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin, requireFinancePermission } from '@/lib/permissions';
import { parsePermissions } from '@/lib/permissions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOwnerFinanceDatabase } from '@/lib/finance-database';

const tables = ['transactions', 'cards', 'accounts', 'categories', 'shoppingLists'] as const;

export async function PUT(request: NextRequest) {
  const access = await requireFinancePermission('edit');
  if ('response' in access) return access.response;
  if (access.role !== 'ADMIN') return NextResponse.json({ error: 'Somente administradores podem gravar em caminhos do servidor.' }, { status: 403 });
  try {
    const body = await request.json();
    const directory = typeof body?.directory === 'string' ? body.directory.trim() : '';
    if (!directory || directory.length > 500 || !path.isAbsolute(directory)) {
      return NextResponse.json({ error: 'Informe um caminho absoluto válido, como /bkp.' }, { status: 400 });
    }
    if (body?.snapshot?.version !== 1 || !body.snapshot.data || typeof body.snapshot.data !== 'object') {
      return NextResponse.json({ error: 'Os dados do backup estão inválidos.' }, { status: 400 });
    }
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
  } catch {
    return NextResponse.json({ error: 'Não foi possível gravar nesse caminho. Confira se a pasta existe e se o app tem permissão de escrita.' }, { status: 400 });
  }
}

export async function GET() {
  const access = await requireFinancePermission('view');
  if ('response' in access) return access.response;
  const db = await getOwnerFinanceDatabase(access.financeOwnerId);
  const [finance, transactions, cards, accounts, categories, shoppingLists] = await Promise.all([
    prisma.finance.findUnique({ where: { id: access.financeId }, select: { name: true, entity: true } }),
    db.transaction.findMany({ where: { financeId: access.financeId } }),
    db.paymentCard.findMany({ where: { financeId: access.financeId } }),
    db.financialInstitution.findMany({ where: { financeId: access.financeId } }),
    db.category.findMany({ where: { financeId: access.financeId } }),
    db.shoppingList.findMany({ where: { financeId: access.financeId }, include: { items: true } }),
  ]);
  return NextResponse.json({ version: 1, createdAt: new Date().toISOString(), finance, data: { transactions, cards, accounts, categories, shoppingLists } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === 'BLOCKED') return NextResponse.json({ error: 'A conta não tem acesso liberado.' }, { status: 403 });
  let financeId = request.cookies.get('active-finance')?.value || '';
  let financeOwnerId = userId;
  let createdFinance = false;
  try {
    const body = await request.json();
    if (body?.version !== 1 || !body.data || typeof body.data !== 'object') return NextResponse.json({ error: 'Arquivo de backup inválido ou incompatível.' }, { status: 400 });
    const selected: (typeof tables)[number][] = Array.isArray(body.selected) ? body.selected.filter((key: string): key is (typeof tables)[number] => tables.includes(key as (typeof tables)[number])) : [];
    if (!selected.length) return NextResponse.json({ error: 'Selecione ao menos um tipo de dado para restaurar.' }, { status: 400 });
    for (const key of selected) if (!Array.isArray(body.data[key])) return NextResponse.json({ error: `O arquivo não contém uma lista válida de ${key}.` }, { status: 400 });
    const data = body.data;
    if (financeId) {
      const membership = await prisma.financeMember.findUnique({ where: { financeId_userId: { financeId, userId } }, include: { finance: { select: { ownerId: true } } } });
      if (!membership) return NextResponse.json({ error: 'Sem acesso a esta instância financeira.' }, { status: 403 });
      if (!parsePermissions(membership.permissions).includes('edit')) return NextResponse.json({ error: 'Sem permissão para restaurar nesta instância.' }, { status: 403 });
      financeOwnerId = membership.finance.ownerId;
    } else {
      const memberships = await prisma.financeMember.count({ where: { userId } });
      if (memberships) return NextResponse.json({ error: 'Selecione a instância financeira que receberá o backup.' }, { status: 400 });
      const backupFinance = body.finance && typeof body.finance === 'object' ? body.finance : {};
      const name = typeof backupFinance.name === 'string' ? backupFinance.name.trim().slice(0, 80) : '';
      const rows = [...data.transactions, ...data.cards, ...data.accounts, ...data.categories];
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
      createdFinance = true;
    }
    const db = await getOwnerFinanceDatabase(financeOwnerId);
    await db.$transaction(async (tx) => {
      if (selected.includes('transactions')) await tx.transaction.deleteMany({ where: { financeId } });
      if (selected.includes('shoppingLists')) await tx.shoppingList.deleteMany({ where: { financeId } });
      if (selected.includes('cards')) await tx.paymentCard.deleteMany({ where: { financeId } });
      if (selected.includes('accounts')) await tx.financialInstitution.deleteMany({ where: { financeId } });
      if (selected.includes('categories')) await tx.category.deleteMany({ where: { financeId } });
      if (selected.includes('cards')) for (const row of data.cards) await tx.paymentCard.create({ data: { ...row, userId, financeId } });
      if (selected.includes('accounts')) for (const row of data.accounts) await tx.financialInstitution.create({ data: { ...row, userId, financeId } });
      if (selected.includes('categories')) for (const row of data.categories) await tx.category.create({ data: { ...row, userId, financeId } });
      if (selected.includes('transactions')) for (const row of data.transactions) await tx.transaction.create({ data: { ...row, userId, financeId } });
      if (selected.includes('shoppingLists')) for (const row of data.shoppingLists) {
        const { items, ...list } = row;
        await tx.shoppingList.create({ data: { ...list, userId, financeId, items: { create: Array.isArray(items) ? items.map(({ id, listId, ...item }: any) => item) : [] } } });
      }
    });
    const response = NextResponse.json({ ok: true, financeId, financeCreated: createdFinance });
    response.cookies.set('active-finance', financeId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch {
    return NextResponse.json({ error: 'Não foi possível restaurar. Confira o arquivo e as relações entre os dados.' }, { status: 400 });
  }
}
