type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** In-process throttle; production must also enforce limits at the reverse proxy/API gateway. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) {
      buckets.forEach((bucket, bucketKey) => {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      });
      while (buckets.size > MAX_BUCKETS) {
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

/** Only trusts forwarded IP headers when explicitly enabled behind a trusted proxy. */
export function getRequestIp(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null;
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  const candidate = (get('x-forwarded-for')?.split(',')[0]?.trim() || get('x-real-ip')?.trim());
  if (!candidate || candidate.length > 64 || /[^0-9a-fA-F:.]/.test(candidate)) return null;
  return candidate;
}
