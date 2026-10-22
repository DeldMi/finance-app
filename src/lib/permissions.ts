import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type Permission = 'view' | 'create' | 'edit' | 'delete';

export type AccessResult =
  | { userId: string; role: string; permissions: Permission[] }
  | { response: NextResponse };

/** Resolve the signed-in account and check its current permission in the database. */
export async function requirePermission(permission: Permission): Promise<AccessResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return { response: NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, permissions: true },
  });

  if (!user) {
    return { response: NextResponse.json({ error: 'Conta não encontrada.' }, { status: 401 }) };
  }

  const permissions = parsePermissions(user.permissions);
  const isAdmin = user.role === 'ADMIN';

  if (!isAdmin && !permissions.includes(permission)) {
    return { response: NextResponse.json({ error: 'Sua conta não tem permissão para esta ação.' }, { status: 403 }) };
  }

  return { userId, role: user.role, permissions };
}

/** Only administrators can change roles and permissions. */
export async function requireAdmin(): Promise<AccessResult> {
  const access = await requirePermission('view');

  if ('response' in access) return access;
  if (access.role !== 'ADMIN') {
    return { response: NextResponse.json({ error: 'Apenas a administração pode alterar permissões.' }, { status: 403 }) };
  }

  return access;
}

export function parsePermissions(value: string): Permission[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Permission =>
        item === 'view' || item === 'create' || item === 'edit' || item === 'delete',
    );
  } catch {
    return [];
  }
}
