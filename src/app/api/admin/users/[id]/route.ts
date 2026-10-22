import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';

const allowedPermissions = ['view', 'create', 'edit', 'delete'];
type Context = { params: { id: string } };

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;

  if (params.id === access.userId) {
    return NextResponse.json({ error: 'Não é possível alterar as próprias permissões.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados de permissão inválidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const role = data.role;
  const permissions = data.permissions;
  if (!['ADMIN', 'USER', 'BLOCKED'].includes(String(role)) || !Array.isArray(permissions) || permissions.some((item) => !allowedPermissions.includes(String(item)))) {
    return NextResponse.json({ error: 'Selecione um nível e permissões válidos.' }, { status: 400 });
  }

  const updated = await prisma.user.updateMany({
    where: { id: params.id },
    data: { role: String(role), permissions: JSON.stringify(Array.from(new Set(permissions))) },
  });

  return updated.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
}
