import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isAllowedOrigin(request: NextRequest, originHeader: string): boolean {
  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>();
  const configuredUrl = process.env.NEXTAUTH_URL;
  if (configuredUrl) {
    try {
      allowedOrigins.add(new URL(configuredUrl).origin);
    } catch {
      // An invalid configured public URL must not expand the allowlist.
      return false;
    }
  } else if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add(request.nextUrl.origin);
  }

  return allowedOrigins.has(origin);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // NextAuth has its own CSRF protection. For other state-changing API requests,
  // reject a supplied Origin that does not match the configured public origin.
  // Same-origin browser requests are checked; non-browser clients that omit Origin
  // remain subject to authentication and server-side authorization checks.
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    MUTATING_METHODS.has(request.method)
  ) {
    const origin = request.headers.get('origin');
    if (origin && !isAllowedOrigin(request, origin)) {
      return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
    }
  }

  if (!pathname.startsWith('/dashboard/')) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
