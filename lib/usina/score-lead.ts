/**
 * 25/11/2026 — Fase2-A: score do lead da landing pública.
 *
 * Regra simples e explicável (o painel mostra este número, não caixa-preta):
 *   - degrau do gasto mensal com energia (quanto maior, mais quente);
 *   - +10 se tem WhatsApp válido (dá para chamar agora);
 *   - teto em100; sem gasto, piso de20 (lead frio, mas não zera).
 */

export type FaixaGasto = "nao_informado" | "baixo" | "medio" | "alto";

export function faixaDoGasto(gasto: number | null | undefined): FaixaGasto {
  if (gasto == null || !(gasto > 0)) return "nao_informado";
  if (gasto < 200) return "baixo";
  if (gasto < 1000) return "medio";
  return "alto";
}

export function calcularScoreLead(entrada: {
  gastoMensalR?: number | null;
  telefone?: string | null;
}): number {
  const gasto = Number(entrada.gastoMensalR ?? 0);
  let base = 20;
  if (gasto > 0) {
    if (gasto < 200) base = 30;
    else if (gasto < 500) base = 50;
    else if (gasto < 1000) base = 70;
    else if (gasto < 3000) base = 85;
    else base = 90;
  }
  const digitos = String(entrada.telefone ?? "").replace(/\D/g, "");
  const bonus = digitos.length >= 10 ? 10 : 0;
  return Math.min(100, base + bonus);
}
