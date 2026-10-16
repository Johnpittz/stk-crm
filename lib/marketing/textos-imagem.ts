/**
 * ITEM 3 (16/10) — texto extra das artes (número + opções do cadastro)
 * e a POSIÇÃO onde o Gemini deve desenhar esses textos.
 * Puro e testado: a rota só junta na hora de montar o prompt.
 */

/** Onde o texto deve aparecer na imagem (pedido do João: canto, rodapé…). */
export const POSICOES_ARTE: Record<string, string> = {
  automatica: "melhor lugar da imagem (o próprio design decide)",
  sup_esq: "canto superior esquerdo",
  sup_dir: "canto superior direito",
  inf_esq: "canto inferior esquerdo",
  inf_dir: "canto inferior direito",
  rodape: "rodapé (parte inferior da imagem, centralizado)",
};

/**
 * Linha do prompt com os textos a desenhar na imagem. Nada → "".
 * Cada item vai entre aspas (o Gemini erra menos texto colado assim).
 */
export function montarTextoImagem(
  numero: string | null | undefined,
  opcoes: string[],
  posicao: string,
): string {
  const frases: string[] = [];
  const limpar = (v: string) => String(v ?? "").trim();
  const numeroLimpo = limpar(numero ?? "");
  if (numeroLimpo) frases.push(numeroLimpo);
  for (const op of opcoes || []) {
    const t = limpar(op);
    if (t) frases.push(t);
  }
  if (frases.length === 0) return "";

  const onde = POSICOES_ARTE[posicao] ?? POSICOES_ARTE.automatica;
  return (
    `Inclua também estes textos, escritos exatamente como estão, grandes e legíveis, no ${onde}: ` +
    frases.map((f) => `"${f}"`).join(", ") +
    "."
  );
}
