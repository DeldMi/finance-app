import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createLoginRedirectUrl, isDashboardPath } from '@/lib/security-guards.mjs';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isAllowedOrigin(request: NextRequest, originHeader: string): boolean {
  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  const configuredUrl = process.env.NEXTAUTH_URL;
  if (configuredUrl) {
    try {
      const publicUrl = new URL(configuredUrl);
      if (process.env.NODE_ENV === 'production' && publicUrl.protocol !== 'https:') return false;
      return origin === publicUrl.origin;
    } catch {
      return false;
    }
  }

  // In production, never infer a trusted origin from proxy-controlled headers.
  return process.env.NODE_ENV !== 'production' && origin === request.nextUrl.origin;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    MUTATING_METHODS.has(request.method)
  ) {
    const origin = request.headers.get('origin');
    if (!origin || !isAllowedOrigin(request, origin)) {
      return NextResponse.json({ error: 'Origem ausente ou não permitida.' }, { status: 403 });
    }
  }

  if (!isDashboardPath(pathname)) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    let loginUrl: URL;
    try {
      loginUrl = createLoginRedirectUrl(pathname, process.env.NEXTAUTH_URL, request.url, process.env.NODE_ENV);
    } catch {
      return NextResponse.json({ error: 'Configuração pública de autenticação inválida.' }, { status: 500 });
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
