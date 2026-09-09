/**
 * Rate limiting por IP com limpeza automática.
 * 
 * Em serverless (Vercel), cada instância mantém seu próprio contador.
 * Serve como primeira camada de proteção contra abuso.
 * 
 * Para proteção robusta contra DDoS, use WAF do Vercel ou Cloudflare.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Rate limit global (qualquer endpoint)
const globalStore = new Map<string, RateLimitEntry>();
// Rate limit por endpoint
const endpointStore = new Map<string, RateLimitEntry>();

// Limpeza a cada 5 minutos
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of globalStore) {
    if (now > entry.resetAt) globalStore.delete(key);
  }
  for (const [key, entry] of endpointStore) {
    if (now > entry.resetAt) endpointStore.delete(key);
  }
}

function getClientIp(request: Request): string {
  // Vercel/Cloudflare: x-forwarded-for é confiável
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

/**
 * Rate limit duplo: global + por endpoint.
 * 
 * @param request - Request HTTP
 * @param options.max - Máximo de requests por janela
 * @param options.windowMs - Janela em milissegundos
 * @param options.globalMax - Máximo global (padrão: max * 3)
 */
export function rateLimit(
  request: Request,
  options: { max: number; windowMs: number; globalMax?: number } = {
    max: 20,
    windowMs: 60_000,
  }
): { allowed: boolean; retryAfter?: number; reason?: string } {
  cleanup();

  const ip = getClientIp(request);
  const now = Date.now();
  const endpoint = request.url.split("?")[0]; // Remove query params

  // 1. Rate limit global por IP (protege todos os endpoints)
  const globalKey = `global:${ip}`;
  const globalEntry = globalStore.get(globalKey);
  const globalMax = options.globalMax || options.max * 3;

  if (globalEntry && now <= globalEntry.resetAt) {
    if (globalEntry.count >= globalMax) {
      const retryAfter = Math.ceil((globalEntry.resetAt - now) / 1000);
      console.warn(`[RateLimit] Global blocked: ${ip} (${globalEntry.count}/${globalMax})`);
      return { allowed: false, retryAfter, reason: "global_limit" };
    }
    globalEntry.count += 1;
  } else {
    globalStore.set(globalKey, { count: 1, resetAt: now + options.windowMs });
  }

  // 2. Rate limit por endpoint
  const endpointKey = `endpoint:${ip}:${endpoint}`;
  const endpointEntry = endpointStore.get(endpointKey);

  if (endpointEntry && now <= endpointEntry.resetAt) {
    if (endpointEntry.count >= options.max) {
      const retryAfter = Math.ceil((endpointEntry.resetAt - now) / 1000);
      console.warn(`[RateLimit] Endpoint blocked: ${ip} on ${endpoint} (${endpointEntry.count}/${options.max})`);
      return { allowed: false, retryAfter, reason: "endpoint_limit" };
    }
    endpointEntry.count += 1;
  } else {
    endpointStore.set(endpointKey, { count: 1, resetAt: now + options.windowMs });
  }

  return { allowed: true };
}
