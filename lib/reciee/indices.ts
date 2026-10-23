/**
 * Códigos do catálogo RECIEE que o motor emite + o guarda da seção 8.
 *
 * O catálogo completo tem 173 índices; o motor só emite os que dá para
 * provar com a fatura + referência oficial. Os demais ficam para a
 * camada de documentos (contrato, cadastro, termo de negociação).
 */

/**
 * Seção 8 do catálogo (continuidade/ressarcimento). A própria regra do
 * RECIEE manda: sem relatório de defeito/medição, a resposta obrigatória é
 * a frase abaixo — o motor NUNCA emite isso como cobrança.
 */
export const INDICES_SECAO_8 = [
  "RECIEE-007",
  "RECIEE-008",
  "RECIEE-026",
  "RECIEE-036",
  "RECIEE-043",
  "RECIEE-048",
  "RECIEE-061",
  "RECIEE-067",
  "RECIEE-094",
  "RECIEE-100",
  "RECIEE-109",
  "RECIEE-119",
  "RECIEE-123",
  "RECIEE-130",
  "RECIEE-145",
  "RECIEE-151",
  "RECIEE-154",
  "RECIEE-159",
  "RECIEE-164",
  "RECIEE-179",
];

export const FRASE_GUARD_SECAO_8 =
  "não identificável conclusivamente apenas pela fatura — exige relatório " +
  "de defeito/medição da distribuidora";

/** Tema (macro-índice) de cada código que o motor sabe emitir. */
export const TEMAS: Record<string, string> = {
  "RECIEE-011": "Bandeiras",
  "RECIEE-016": "Tributos",
  "RECIEE-050": "Tributos",
  "RECIEE-051": "Medição e leitura",
  "RECIEE-058": "Tarifação",
  "RECIEE-077": "Medição e leitura",
  "RECIEE-131": "Faturamento",
  "RECIEE-134": "Medição e leitura",
  "RECIEE-148": "Faturamento",
  "RECIEE-160": "Tributos",
  "RECIEE-162": "Medição e leitura",
  "RECIEE-T69-001": "Tributos",
  "MOTOR-SOMA": "Faturamento",
  "MOTOR-LINHA": "Tarifação",
  "MOTOR-TARIFA-REF": "Tarifação",
  "MOTOR-FURO": "Medição e leitura",
};

export function temaDe(codigo: string): string {
  return TEMAS[codigo] ?? "RECIEE";
}
