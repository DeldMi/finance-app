import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireFinancePermission } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const access = await requireFinancePermission('view');
  if ('response' in access) return access.response;
  if (access.role !== 'ADMIN') return NextResponse.json({ error: 'Somente administradores podem acessar backups no servidor.' }, { status: 403 });
  const directory = request.nextUrl.searchParams.get('directory')?.trim() || '';
  const name = (await params).name;
  const prefix = `meu-financeiro-${access.financeId}-`;
  const allowedDirectory = path.resolve(process.env.BACKUP_DIR || '/bkp');
  if (!directory || !path.isAbsolute(directory) || directory.length > 500 || path.resolve(directory) !== allowedDirectory || name !== path.basename(name) || !name.startsWith(prefix) || !name.endsWith('.json')) {
    return NextResponse.json({ error: 'Arquivo de backup inválido ou diretório não permitido.' }, { status: 400 });
  }
  try {
    const snapshot: unknown = JSON.parse(await readFile(path.join(path.resolve(directory), name), 'utf8'));
    if (!snapshot || typeof snapshot !== 'object' || (snapshot as { version?: number }).version !== 1) {
      return NextResponse.json({ error: 'O arquivo selecionado não é um backup compatível.' }, { status: 400 });
    }
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ error: 'Não foi possível abrir o backup selecionado.' }, { status: 404 });
  }
}
