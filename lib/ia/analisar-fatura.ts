/**
 * PARTE 11 (PPTX 17/10) — "Análise da conta": a IA lê a foto/PDF da
 * fatura de energia e extrai os dados pra pasta do cliente.
 * Puro e testável: a rota só junta bytes + chamada do provedor.
 */
import { chamarModelo, chamarModeloVision } from "../ia-provider";

export interface ResumoFatura {
  concessionaria: string | null;
  uc: string | null;
  titular: string | null;
  cnpj_cpf: string | null;
  vencimento: string | null;
  consumo: string | null;
  valor: string | null;
}

const VAZIO: ResumoFatura = {
  concessionaria: null,
  uc: null,
  titular: null,
  cnpj_cpf: null,
  vencimento: null,
  consumo: null,
  valor: null,
};

export function montarPromptFatura(): string {
  return [
    "Você lê UMA conta de energia elétrica brasileira (foto ou print).",
    "Extraia APENAS o que estiver escrito, sem inventar nada.",
    'Responda somente com um JSON (sem markdown) no formato:',
    '{"concessionaria":"","uc":"","titular":"","cnpj_cpf":"","vencimento":"","consumo":"","valor":""}',
    "Onde: concessionaria = nome da distribuidora; uc = número da Unidade",
    "Consumidora; titular = nome do titular; cnpj_cpf = documento; vencimento",
    "= dia do vencimento (só números); consumo = consumo em kWh (só números);",
    "valor = valor total a pagar (só números, com ponto). Campo não",
    "encontrado = null.",
  ].join(" ");
}

function campo(json: Record<string, unknown>, chave: string): string | null {
  const v = json[chave];
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" || t.toLowerCase() === "null" ? null : t;
}

/** Lê a resposta (tolerante a ```json e texto em volta) e normaliza. */
export function parseRespostaFatura(resposta: string): ResumoFatura {
  const bruto = resposta || "";
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return { ...VAZIO };
  try {
    const json = JSON.parse(bruto.slice(inicio, fim + 1));
    return {
      concessionaria: campo(json, "concessionaria"),
      uc: campo(json, "uc"),
      titular: campo(json, "titular"),
      cnpj_cpf: campo(json, "cnpj_cpf"),
      vencimento: campo(json, "vencimento"),
      consumo: campo(json, "consumo"),
      valor: campo(json, "valor"),
    };
  } catch {
    return { ...VAZIO };
  }
}

/**
 * Caminho de TEXTO (PDF da fatura já convertido em texto pela rota).
 */
export async function analisarFaturaTexto(textoExtraido: string): Promise<ResumoFatura> {
  try {
    const resposta = await chamarModelo(
      `${montarPromptFatura()}\n\nTexto da conta:\n${(textoExtraido || "").slice(0, 6000)}`
    );
    return parseRespostaFatura(resposta);
  } catch {
    return { ...VAZIO };
  }
}

/**
 * `analisarFatura({ mimeTipo, base64 })` — usa MIMO/Gemini com visão.
 * Nunca lança: resposta ilegível vira campos null.
 */
export async function analisarFatura(entrada: {
  mimeTipo: string;
  base64: string;
}): Promise<ResumoFatura> {
  try {
    const dataUrl = `data:${entrada.mimeTipo};base64,${entrada.base64}`;
    const resposta = await chamarModeloVision(montarPromptFatura(), dataUrl);
    return parseRespostaFatura(resposta);
  } catch {
    return { ...VAZIO };
  }
}
