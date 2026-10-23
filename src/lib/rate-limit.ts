type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Process-local defense-in-depth throttle. Production deployments with multiple
 * replicas must also enforce rate limits at the reverse proxy/API gateway.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      buckets.forEach((bucket, bucketKey) => {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      });
      while (buckets.size > 10_000) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey === undefined) break;
        buckets.delete(oldestKey);
      }
    }
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/**
 * Forwarding headers are attacker-controlled unless a trusted reverse proxy
 * overwrites them. Only use them when the deployment explicitly opts in.
 * If trust is not configured, callers should apply account-based throttling
 * and let the proxy/gateway enforce per-client IP limits.
 */
export function getRequestIp(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null;

  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const forwarded = get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = get('x-real-ip')?.trim();
  const candidate = forwarded || realIp;
  if (!candidate || candidate.length > 64 || /[^0-9a-fA-F:.]/.test(candidate)) return null;
  return candidate;
}
