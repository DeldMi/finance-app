import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;
  const directory = request.nextUrl.searchParams.get('directory')?.trim() || '';
  if (!directory || directory.length > 500 || !path.isAbsolute(directory)) {
    return NextResponse.json({ error: 'Informe um caminho absoluto válido.' }, { status: 400 });
  }
  try {
    const prefix = `meu-financeiro-${access.userId}-`;
    const files = await readdir(path.resolve(directory), { withFileTypes: true });
    const backups = await Promise.all(files
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.json'))
      .map(async (entry) => ({ name: entry.name, modifiedAt: (await stat(path.join(directory, entry.name))).mtime.toISOString() })));
    backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return NextResponse.json(backups);
  } catch {
    return NextResponse.json({ error: 'Não foi possível listar os backups. Confira o caminho e a permissão de leitura.' }, { status: 400 });
  }
}
