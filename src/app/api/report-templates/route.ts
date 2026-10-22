import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

const MODELS_DIRECTORY = path.join(process.cwd(), 'reports', 'models');

/** Return available local HTML/CSS report models for the current user. */
export async function GET() {
  const access = await requirePermission('view');
  if ('response' in access) return access.response;

  try {
    const files = await readdir(MODELS_DIRECTORY);
    const names = files
      .filter((file) => file.endsWith('.html'))
      .map((file) => file.slice(0, -5))
      .filter((name) => files.includes(`${name}.css`));

    const models = await Promise.all(names.map(async (name) => ({
      name,
      html: await readFile(path.join(MODELS_DIRECTORY, `${name}.html`), 'utf8'),
      css: await readFile(path.join(MODELS_DIRECTORY, `${name}.css`), 'utf8'),
    })));

    return NextResponse.json(models);
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler os modelos de relatório.' }, { status: 500 });
  }
}
