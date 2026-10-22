import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin, requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const tables = ['transactions', 'cards', 'accounts', 'categories', 'shoppingLists'] as const;

export async function PUT(request: NextRequest) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;
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
    const prefix = `meu-financeiro-${access.userId}-`;
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
  const access = await requirePermission('view');
  if ('response' in access) return access.response;
  const [transactions, cards, accounts, categories, shoppingLists] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: access.userId } }),
    prisma.paymentCard.findMany({ where: { userId: access.userId } }),
    prisma.financialInstitution.findMany({ where: { userId: access.userId } }),
    prisma.category.findMany({ where: { userId: access.userId } }),
    prisma.shoppingList.findMany({ where: { userId: access.userId }, include: { items: true } }),
  ]);
  return NextResponse.json({ version: 1, createdAt: new Date().toISOString(), data: { transactions, cards, accounts, categories, shoppingLists } });
}

export async function POST(request: NextRequest) {
  const access = await requirePermission('edit');
  if ('response' in access) return access.response;
  try {
    const body = await request.json();
    if (body?.version !== 1 || !body.data || typeof body.data !== 'object') return NextResponse.json({ error: 'Arquivo de backup inválido ou incompatível.' }, { status: 400 });
    const selected: (typeof tables)[number][] = Array.isArray(body.selected) ? body.selected.filter((key: string): key is (typeof tables)[number] => tables.includes(key as (typeof tables)[number])) : [];
    if (!selected.length) return NextResponse.json({ error: 'Selecione ao menos um tipo de dado para restaurar.' }, { status: 400 });
    for (const key of selected) if (!Array.isArray(body.data[key])) return NextResponse.json({ error: `O arquivo não contém uma lista válida de ${key}.` }, { status: 400 });
    const data = body.data;
    await prisma.$transaction(async (tx) => {
      if (selected.includes('transactions')) await tx.transaction.deleteMany({ where: { userId: access.userId } });
      if (selected.includes('shoppingLists')) await tx.shoppingList.deleteMany({ where: { userId: access.userId } });
      if (selected.includes('cards')) await tx.paymentCard.deleteMany({ where: { userId: access.userId } });
      if (selected.includes('accounts')) await tx.financialInstitution.deleteMany({ where: { userId: access.userId } });
      if (selected.includes('categories')) await tx.category.deleteMany({ where: { userId: access.userId } });
      if (selected.includes('cards')) for (const row of data.cards) await tx.paymentCard.create({ data: { ...row, userId: access.userId } });
      if (selected.includes('accounts')) for (const row of data.accounts) await tx.financialInstitution.create({ data: { ...row, userId: access.userId } });
      if (selected.includes('categories')) for (const row of data.categories) await tx.category.create({ data: { ...row, userId: access.userId } });
      if (selected.includes('transactions')) for (const row of data.transactions) await tx.transaction.create({ data: { ...row, userId: access.userId } });
      if (selected.includes('shoppingLists')) for (const row of data.shoppingLists) {
        const { items, ...list } = row;
        await tx.shoppingList.create({ data: { ...list, userId: access.userId, items: { create: Array.isArray(items) ? items.map(({ id, listId, ...item }: any) => item) : [] } } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível restaurar. Confira o arquivo e as relações entre os dados.' }, { status: 400 });
  }
}
