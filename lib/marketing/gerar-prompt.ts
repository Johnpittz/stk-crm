/**
 * PEDIDO 3 (11/10) — o "grande prompt" guiado da tela de artes.
 *
 * O vendedor escolhe o TIPO de post e preenche assunto/texto/estilo;
 * aqui tudo vira UM prompt pronto para o Gemini (Nano Banana) gerar a
 * arte. Puro e testado: a tela só exibe o resultado.
 *
 * Formatos = decisão do João (11/10): assistente guiado tipo de post,
 * "como se fosse um grande prompt".
 */

export interface FormatosArte {
  nome: string;
  /** proporção legível (para a tela) */
  proporcao: string;
  /** dimensões exatas exigidas da imagem */
  orientacao: string;
  /** MELHORIA 13/10: valor aceito por generationConfig.imageConfig.aspectRatio */
  aspectRatio: string;
}

export const FORMATOS_ARTE: Record<string, FormatosArte> = {
  feed_insta: {
    nome: "Feed do Instagram",
    proporcao: "1:1",
    orientacao: "quadrada, 1080x1080",
    aspectRatio: "1:1",
  },
  story: {
    nome: "Story e Reels (Instagram)",
    proporcao: "9:16",
    orientacao: "vertical, 1080x1920",
    aspectRatio: "9:16",
  },
  facebook: {
    nome: "Post do Facebook",
    proporcao: "1:1",
    orientacao: "quadrada, 1080x1080",
    aspectRatio: "1:1",
  },
  banner: {
    nome: "Banner / anúncio",
    proporcao: "1.91:1",
    orientacao: "horizontal, 1200x628",
    aspectRatio: "16:9",
  },
};

export const ESTILO_PADRAO = "moderno, limpo e profissional";

export interface CamposArte {
  formato: string;
  assunto: string;
  texto: string;
  estilo?: string | null;
  observacoes?: string | null;
}

/**
 * Monta o prompt final (o "grande prompt" que o vendedor vê antes de
 * gerar). Regra importante: o TEXTO digitado vai entre aspas e com a
 * instrução de exatidão — o Gemini é fraco em letra cortada.
 */
export function montarPromptArte(c: CamposArte): string {
  const formato = FORMATOS_ARTE[c.formato];
  const linhas: string[] = [];

  linhas.push(
    `Crie uma imagem de marketing profissional para ${formato?.nome ?? c.formato} ` +
      `(${formato?.orientacao ?? "1080x1080"}).`,
  );
  linhas.push(`Assunto: ${c.assunto.trim()}`);
  linhas.push(
    `A imagem DEVE exibir exatamente este texto, sem erros, sem letras cortadas nem duplicadas: "${c.texto.trim()}"`,
  );
  linhas.push(`Estilo visual: ${(c.estilo ?? "").trim() || ESTILO_PADRAO}.`);
  if (c.observacoes && c.observacoes.trim()) {
    linhas.push(`Observações do cliente: ${c.observacoes.trim()}`);
  }
  linhas.push(
    "Regras: composição equilibrada, texto grande e legível, cores consistentes, " +
      "sem marca d'água, sem logotipos inventados e sem texto além do solicitado.",
  );
  return linhas.join("\n");
}

/* ── MELHORIA 12/10: imagens de referência (receita do AUTOIMAGEM) ── */

/** Nome da referência → marker estável: "Logo STK" → logo_stk. */
export function slugificarMarker(nome: string): string {
  const slug = String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "imagem";
}

export interface ReferenciaImagem {
  marker: string;
  data: string; // base64 puro (sem prefixo data:)
  mimeType: string;
}

export type ParteGemini =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/**
 * Prompt com {{marker}} → a imagem entra NAQUELE ponto do texto;
 * referência não citada vai na frente mesmo assim (sempre participa).
 * Marker sem referência cadastrada fica no texto (não quebra nada).
 */
export function montarPartesImagem(
  prompt: string,
  referencias: ReferenciaImagem[],
): ParteGemini[] {
  if (!referencias || referencias.length === 0) return [{ text: prompt }];
  const citadas: ReferenciaImagem[] = [];
  const naoCitadas: ReferenciaImagem[] = [];
  for (const r of referencias) {
    if (prompt.includes(`{{${r.marker}}}`)) citadas.push(r);
    else naoCitadas.push(r);
  }
  const partes: ParteGemini[] = naoCitadas.map((r) => ({
    inlineData: { mimeType: r.mimeType, data: r.data },
  }));
  let resto = prompt;
  for (const r of citadas) {
    const marca = `{{${r.marker}}}`;
    const i = resto.indexOf(marca);
    if (i < 0) continue;
    const antes = resto.slice(0, i);
    if (antes) partes.push({ text: antes });
    partes.push({ inlineData: { mimeType: r.mimeType, data: r.data } });
    resto = resto.slice(i + marca.length);
  }
  if (resto) partes.push({ text: resto });
  return partes;
}
