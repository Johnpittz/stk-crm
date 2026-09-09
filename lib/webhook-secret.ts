/**
 * Webhook Secret para validação de webhooks do WhatsApp.
 * 
 * Gere um segredo forte e configure como variável de ambiente:
 *   WEBHOOK_SECRET=<token-aleatorio>
 * 
 * A Evolution API deve enviar este header em cada webhook:
 *   X-Webhook-Secret: <token>
 * 
 * Se WEBHOOK_SECRET não estiver configurado, a validação é ignorada
 * (para não quebrar em desenvolvimento).
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * Valida se o webhook veio da fonte esperada.
 * Retorna true se válido ou se não há secret configurado (dev mode).
 */
export function validateWebhookSecret(request: Request): boolean {
  if (!WEBHOOK_SECRET) {
    // Sem secret configurado — modo desenvolvimento, aceita tudo
    console.warn("[Webhook] WEBHOOK_SECRET não configurado — validação desabilitada");
    return true;
  }

  const provided = request.headers.get("x-webhook-secret") || "";
  
  if (!provided) {
    console.warn("[Webhook] Header X-Webhook-Secret ausente");
    return false;
  }

  // Comparação timing-safe para evitar timing attacks
  if (provided.length !== WEBHOOK_SECRET.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ WEBHOOK_SECRET.charCodeAt(i);
  }
  return result === 0;
}
