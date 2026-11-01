/**
 * Small, dependency-free guards shared by middleware and Node's test runner.
 */
export function isDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function createLoginRedirectUrl(pathname, configuredPublicUrl, requestUrl, nodeEnv) {
  let base;
  if (configuredPublicUrl) {
    base = new URL(configuredPublicUrl);
    if (base.username || base.password || base.search || base.hash) {
      throw new Error('NEXTAUTH_URL must be a clean public origin URL');
    }
    if (nodeEnv === 'production' && base.protocol !== 'https:') {
      throw new Error('NEXTAUTH_URL must use HTTPS in production');
    }
  } else {
    if (nodeEnv === 'production') {
      throw new Error('NEXTAUTH_URL is required in production');
    }
    base = new URL(requestUrl);
  }

  const safePath = typeof pathname === 'string' && pathname.startsWith('/') &&
    !pathname.startsWith('//') && !pathname.includes('\\\\') ? pathname : '/dashboard';
  const loginUrl = new URL('/login', base);
  loginUrl.searchParams.set('callbackUrl', safePath);
  return loginUrl;
}
