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
  // FASE A (17/10) — campos pra aplicar as regras comerciais
  grupo: "A" | "B" | null;
  contratacao_livre: boolean | null;
  cnae_principal: string | null;
  consumo_ponta: number | null;
  energia_injetada: number | null;
  uc_geradora: string | null;
  uc_consumidora: string | null;
}

const VAZIO: ResumoFatura = {
  concessionaria: null,
  uc: null,
  titular: null,
  cnpj_cpf: null,
  vencimento: null,
  consumo: null,
  valor: null,
  grupo: null,
  contratacao_livre: null,
  cnae_principal: null,
  consumo_ponta: null,
  energia_injetada: null,
  uc_geradora: null,
  uc_consumidora: null,
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
    "Também extraia, quando estiver na conta: grupo = classe tarifária",
    "(\"A\" ou \"B\"); contratacao_livre = true se a conta indicar",
    "contratação livre/demanda livre/ACL e false se for mercado regulado;",
    "cnae_principal = CNAE do titular (se houver); consumo_ponta = consumo",
    "no HORÁRIO DE PONTA em kWh; energia_injetada = energia injetada ou",
    "compensada (usina solar) em kWh; uc_geradora = número da UC geradora",
    "e uc_consumidora = número da UC consumidora (sem pontos/traços).",
    "Nesses campos use true/false/número ou null — sem aspas.",
  ].join(" ");
}

function campo(json: Record<string, unknown>, chave: string): string | null {
  const v = json[chave];
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" || t.toLowerCase() === "null" ? null : t;
}

function paraGrupo(v: unknown): "A" | "B" | null {
  const t = String(v ?? "").trim().toUpperCase();
  return t === "A" || t === "B" ? t : null;
}

function paraBooleano(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  const t = String(v ?? "").trim().toLowerCase();
  if (["true", "sim", "1", "livre", "demanda livre", "acl"].includes(t)) return true;
  if (["false", "nao", "não", "0", "regulado"].includes(t)) return false;
  return null;
}

function paraNumero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
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
      grupo: paraGrupo(json.grupo),
      contratacao_livre: paraBooleano(json.contratacao_livre),
      cnae_principal: campo(json, "cnae_principal"),
      consumo_ponta: paraNumero(json.consumo_ponta),
      energia_injetada: paraNumero(json.energia_injetada),
      uc_geradora: campo(json, "uc_geradora"),
      uc_consumidora: campo(json, "uc_consumidora"),
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
  } catch (erro) {
    // visível nos logs (Vercel) — a IA pode falhar por chave/timeout
    console.error(
      "[analisarFaturaTexto]",
      (erro as Error)?.message ?? String(erro)
    );
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
