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
}

export const FORMATOS_ARTE: Record<string, FormatosArte> = {
  feed_insta: {
    nome: "Feed do Instagram",
    proporcao: "1:1",
    orientacao: "quadrada, 1080x1080",
  },
  story: {
    nome: "Story e Reels (Instagram)",
    proporcao: "9:16",
    orientacao: "vertical, 1080x1920",
  },
  facebook: {
    nome: "Post do Facebook",
    proporcao: "1:1",
    orientacao: "quadrada, 1080x1080",
  },
  banner: {
    nome: "Banner / anúncio",
    proporcao: "1.91:1",
    orientacao: "horizontal, 1200x628",
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
