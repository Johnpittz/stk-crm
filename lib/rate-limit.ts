/**
 * Rate limiting simples por IP (memória local).
 * Nota: em ambiente serverless com múltiplas instâncias, cada instância
 * mantém seu próprio contador. Serve como primeira camada de proteção.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

export function rateLimit(
  request: Request,
  options: { max: number; windowMs: number } = { max: 20, windowMs: 60_000 }
): { allowed: boolean; retryAfter?: number } {
  const ip = getClientIp(request);
  const now = Date.now();
  const key = `${ip}:${request.url}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (entry.count >= options.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  store.set(key, entry);
  return { allowed: true };
}
