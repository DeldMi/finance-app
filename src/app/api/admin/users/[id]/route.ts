import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';

const allowedPermissions = ['view', 'create', 'edit', 'delete'];
type Context = { params: { id: string } };

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdmin();
  if ('response' in access) return access.response;

  if (params.id === access.userId) {
    return NextResponse.json({ error: 'N?o ? poss?vel alterar as pr?prias permiss?es.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inv?lido.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Dados de permiss?o inv?lidos.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const role = data.role;
  const permissions = data.permissions;
  if (!['ADMIN', 'USER', 'BLOCKED'].includes(String(role)) || !Array.isArray(permissions) || permissions.some((item) => !allowedPermissions.includes(String(item)))) {
    return NextResponse.json({ error: 'Selecione um n?vel e permiss?es v?lidos.' }, { status: 400 });
  }

  const updated = await prisma.user.updateMany({
    where: { id: params.id },
    data: { role: String(role), permissions: JSON.stringify([...new Set(permissions)]) },
  });

  return updated.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Usu?rio n?o encontrado.' }, { status: 404 });
}
