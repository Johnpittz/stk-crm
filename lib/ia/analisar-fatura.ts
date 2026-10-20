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
    "('A' ou 'B' — se a conta mostrar B3, B2, A5, devolva só a letra);",
    "contratacao_livre = true se a conta indicar",
    "contratação livre/demanda livre/ACL e false se for mercado regulado;",
    "cnae_principal = CNAE do titular (se houver); consumo_ponta = consumo",
    "no HORÁRIO DE PONTA em kWh (se a conta não medir ponta — Grupo B —,",
    "devolva null; nunca use o consumo total no lugar da ponta);",
    "energia_injetada = energia injetada ou",
    "compensada (usina solar) em kWh; uc_geradora = número da UC geradora",
    "e uc_consumidora = número da UC consumidora (sem pontos/traços).",
    "Nesses campos use true/false/número ou null — sem aspas.",
    "Números: SEM separador de milhar e com PONTO decimal (5571.22,",
    "4548.0) — mesmo que a conta escreva 5.571,22.",
  ].join(" ");
}

function campo(json: Record<string, unknown>, chave: string): string | null {
  const v = json[chave];
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" || t.toLowerCase() === "null" ? null : t;
}

/**
 * 19/10 — protocolo Sustentalski: a conta real traz "B3 — Comercial",
 * "A5", "B2 — Rural". Classe A/B é a PRIMEIRA letra; exigir "A"/"B"
 * exatos jogava o grupo pra null e a tela de oportunidades de Grupo B
 * inteira ficava "preliminar" sem motivo nenhum.
 */
export function paraGrupo(v: unknown): "A" | "B" | null {
  // a classe pode vir no meio do texto ("Grupo B3", "B2 — Rural")
  const m = String(v ?? "").toUpperCase().match(/(?:^|\s)([AB])(?=\d|\s|$)/);
  return m ? (m[1] as "A" | "B") : null;
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

/**
 * 19/10 — número como a CONTA brasileira escreve: "5.495,48" (milhar +
 * decimal), "4.548" (milhar só), "5495.48" (americano), "1.174665"
 * (preço unitário). `Number()` cru dava NaN em "10.994,80" e virava
 * 4,548 em "4.548" — é o que deixou valor/consumo errados na tela.
 */
export function numeroBR(v: unknown): number | null {
  if (v == null) return null;
  let t = String(v).replace(/[^\d.,-]/g, "");
  if (!t) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    // os dois separadores: quem vem DEPOIS é o decimal
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula >= 0) {
    // só vírgula: em conta BR é decimal — "1,025" (3 dígitos) é milhar
    t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (ponto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    // só ponto e casa de milhar ("4.548") → milhar; "1.174665" não casa → decimal
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Diagnóstico do caminho da fatura (06/10 debug): guarda a mensagem da
 * última falha de IA p/ a rota devolver no 422 (sem segredos — só o erro).
 */
export const diagFatura: { erro: string | null } = { erro: null };

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
      consumo_ponta: numeroBR(json.consumo_ponta),
      energia_injetada: numeroBR(json.energia_injetada),
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
  diagFatura.erro = null;
  try {
    const resposta = await chamarModelo(
      `${montarPromptFatura()}\n\nTexto da conta:\n${(textoExtraido || "").slice(0, 6000)}`
    );
    const resumo = parseRespostaFatura(resposta);
    if (!resumo.concessionaria && !resumo.uc && !resumo.valor) {
      // debug do teste: a IA respondeu mas sem JSON reconhecível
      diagFatura.erro = `resposta_sem_json: ${String(resposta).slice(0, 150)}`;
    } else {
      diagFatura.erro = null;
    }
    return resumo;
  } catch (erro) {
    // visível nos logs (Vercel) — a IA pode falhar por chave/timeout
    const msg = (erro as Error)?.message ?? String(erro);
    diagFatura.erro = msg.slice(0, 200);
    console.error("[analisarFaturaTexto]", msg);
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
    diagFatura.erro = null;
    return parseRespostaFatura(resposta);
  } catch (erro) {
    diagFatura.erro = String((erro as Error)?.message || erro).slice(0, 200);
    return { ...VAZIO };
  }
}
