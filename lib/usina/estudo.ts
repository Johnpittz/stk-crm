/**
 * 25/11/2026 — Fase1: persistência do ESTUDO de usina.
 *
 * O estudo mora DENTRO da coluna `clientes.usina` (JSON que a AXS consome:
 * { CRI, usina, potencia }). Acrescentamos a chave `estudo` sem migration.
 * Testado em lib/usina/estudo.test.ts.
 */

export interface EstudoUsina {
  geradoEm: string;
  consumoMensalKwh: number;
  tarifaRpkwh: number;
  metaPct: number;
  modulo: { marca: string; modelo: string; wp: number };
  inversor?: { marca: string; modelo: string; kw: number } | null;
  /** preço digitado à mão pelo vendedor (placeholder — pode ser null). */
  precoKitR?: number | null;
  observacao?: string;
  resultado: {
    kwpNecessario: number;
    kwpInstalado: number;
    numPaineis: number;
    geracaoMensalKwh: number;
    cobrePct: number;
    economiaMensalR: number;
    economiaAnualR: number;
    paybackAnos: number | null;
    co2EvitadoTons: number;
    areaM2: number;
  };
}

/** Lê o JSON atual da coluna usina (tolerante a vazio/corrompido). */
function parseAtual(valor: string | null | undefined): Record<string, unknown> {
  if (!valor) return {};
  try {
    const obj = JSON.parse(valor);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Merge: preserva CRI/usina/potencia (e QUALQUER outra chave já gravada)
 * e grava/atualiza `estudo`.
 */
export function gravarEstudo(valorUsinaAtual: string | null | undefined, estudo: EstudoUsina): string {
  return JSON.stringify({ ...parseAtual(valorUsinaAtual), estudo });
}

/** Lê o estudo gravado; null quando não existe/inválido. */
export function parseEstudo(valorUsina: string | null | undefined): EstudoUsina | null {
  const bruto = parseAtual(valorUsina)["estudo"];
  if (!bruto || typeof bruto !== "object") return null;
  return bruto as EstudoUsina;
}
