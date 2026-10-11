/**
 * IA identifica oportunidades da CONTA (pedido do João, 06/10).
 *
 * Divisão acertada com ele:
 *  - a MIMO (via lib/ia-provider) só EXTRAI da conversa: há conta? valor?
 *    Grupo A ou B?
 *  - quem aplica a regra é o CÓDIGO (determinístico, testável):
 *      valor da conta > R$ 5.000  → RECIEE (prioridade);
 *      Grupo B (até R$ 5.000)     → GD;
 *      caso contrário             → não é oportunidade.
 */
import { chamarModelo, chamarModeloVision } from '../ia-provider'
import { extrairTextoPdf } from './pdf-texto'

export const LIMIAR_RECIEE = 5000

export interface AnaliseConta {
  achouConta: boolean
  valorConta: number | null
  grupo: 'A' | 'B' | null
}

export type Classificacao = { tipo: 'reciee' | 'gd'; motivo: string } | { tipo: null; motivo: string }

/** Pré-filtro barato: só chama a IA se a conversa parecer falar de conta. */
export function mensagemFalaDeConta(mensagem: string): boolean {
  const m = (mensagem || '').toLowerCase()
  if (!m.trim()) return false
  return (
    /(conta|fatura|kwh|quilowatt|consumo|energia|el[eé]tric|tarifa|bandeira|concession[aá]ria|luz)/.test(
      m,
    ) || /r\$\s*[\d.,]+/.test(m)
  )
}

/** Aplica as regras aprovadas — nunca lança. */
export function aplicarRegras(analise: AnaliseConta): Classificacao {
  if (!analise.achouConta) {
    return { tipo: null, motivo: 'Nenhuma conta identificada na conversa.' }
  }
  const acimaDoLimiar =
    analise.valorConta != null && Number.isFinite(analise.valorConta) && analise.valorConta > LIMIAR_RECIEE
  if (acimaDoLimiar) {
    const excedeuGrupoB = analise.grupo === 'B' ? ' (prioridade sobre o Grupo B)' : ''
    return {
      tipo: 'reciee',
      motivo: `Conta de R$ ${analise.valorConta} acima de R$ 5.000 — regra RECIEE${excedeuGrupoB}.`,
    }
  }
  if (analise.grupo === 'B') {
    return { tipo: 'gd', motivo: 'Conta do Grupo B até R$ 5.000 — regra GD.' }
  }
  return { tipo: null, motivo: 'Conta até R$ 5.000 e não é do Grupo B — sem oportunidade.' }
}

function normalizarValor(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/r\$/gi, '').trim()
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function normalizarGrupo(g: unknown): 'A' | 'B' | null {
  if (g == null) return null
  const s = String(g).trim().toUpperCase()
  if (!s || s === 'NULL') return null
  if (s.includes('B')) return 'B'
  if (s.includes('A')) return 'A'
  return null
}

/** Lê a resposta da MIMO (JSON puro, JSON em ```json, ou lixo) — nunca lança. */
export function extrairAnalise(texto: string): AnaliseConta {
  const vazio: AnaliseConta = { achouConta: false, valorConta: null, grupo: null }
  try {
    const m = (texto || '').match(/\{[\s\S]*\}/)
    if (!m) return vazio
    const obj = JSON.parse(m[0])
    const valorConta = normalizarValor(obj.valorConta)
    const grupo = normalizarGrupo(obj.grupo)
    const achouConta = Boolean(obj.achouConta) || valorConta != null || grupo != null
    return achouConta ? { achouConta: true, valorConta, grupo } : vazio
  } catch {
    return vazio;
  }
}

/* ── V2 (06/10): a conta pode chegar como FOTO ou PDF ───────────────── */

const MIDIAS_ANALISAVEIS = new Set(["image", "imagem", "document", "documento", "pdf"]);

/** true para imagem e documento/PDF (áudio/vídeo/sticker não são conta). */
export function ehMidiaAnalisavel(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  return MIDIAS_ANALISAVEIS.has(String(tipo).trim().toLowerCase());
}

/** Junta o texto extraído do PDF com a legenda da mensagem. */
export function montarMensagemDaFatura(textoPdf: string, legenda?: string | null): string {
  const corpo =
    `O cliente enviou um ARQUIVO (PDF) da conta de energia. Texto extraído do arquivo:\n` +
    (textoPdf || "").slice(0, 6000);
  return legenda ? `Legenda do arquivo: "${legenda}".\n${corpo}` : corpo;
}

async function baixarMidia(url: string, timeoutMs = 20000): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`midia HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > 40 * 1024 * 1024) throw new Error("mídia maior que 40MB");
    const contentType = String(resp.headers.get("content-type") || "").split(";")[0].trim();
    return { bytes: buffer, contentType };
  } finally {
    clearTimeout(limite);
  }
}

function dataUrlDe(bytes: Buffer, contentType: string, url: string): string {
  const mime =
    contentType && contentType.includes("/")
      ? contentType
      : /\.png($|\?)/i.test(url) ? "image/png"
      : /\.webp($|\?)/i.test(url) ? "image/webp"
      : /\.gif($|\?)/i.test(url) ? "image/gif"
      : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export interface ParamsMidia {
  url: string;
  tipo?: string | null;
  legenda?: string | null;
  nomeCliente?: string;
  historico?: Array<{ remetente: string; conteudo: string }>;
  env?: Record<string, string | undefined>;
}

/**
 * Analisa a mídia do cliente:
 *  - FOTO → MIMO lê a imagem (visão multimodal) e extrai valor/grupo;
 *  - PDF  → texto extraído localmente (pdf2json) e passa pelo mesmo
 *           extrator de texto da conversa.
 * LANÇA em falha de download/leitura/IA — o chamador vira `erro` (e o cron
 * de conferência sinaliza).
 */
export async function analisarMidiaComIA(p: ParamsMidia): Promise<AnaliseConta> {
  if (!ehMidiaAnalisavel(p.tipo)) {
    return { achouConta: false, valorConta: null, grupo: null };
  }
  const { bytes, contentType } = await baixarMidia(p.url);

  if (String(p.tipo).toLowerCase() === "image" || String(p.tipo).toLowerCase() === "imagem") {
    const prompt = montarPromptClassificacao({
      nomeCliente: p.nomeCliente,
      mensagem:
        `O cliente enviou uma FOTO${p.legenda ? ` (legenda: "${p.legenda}")` : ""}. ` +
        "Se for uma conta de energia (fatura), extraia os dados; se não for, responda achouConta=false.",
      historico: p.historico,
    });
    const resposta = await chamarModeloVision(prompt, dataUrlDe(bytes, contentType, p.url), p.env);
    return extrairAnalise(resposta);
  }

  const textoPdf = await extrairTextoPdf(bytes);
  const resposta = await chamarModelo(
    montarPromptClassificacao({
      nomeCliente: p.nomeCliente,
      mensagem: montarMensagemDaFatura(textoPdf, p.legenda),
      historico: p.historico,
    }),
    p.env,
  );
  return extrairAnalise(resposta);
}

/** Prompt enviado à MIMO (mesma API do atendimento). */
export function montarPromptClassificacao(params: {
  nomeCliente?: string
  mensagem: string
  historico?: Array<{ remetente: string; conteudo: string }>
}): string {
  const linhasHistorico = (params.historico || [])
    .map((h) => `- ${h.remetente}: ${h.conteudo}`)
    .join('\n')
  return [
    'Você analisa conversas de atendimento de uma empresa de energia e identifica se o cliente enviou dados da sua CONTA DE ENERGIA.',
    '',
    `Cliente: ${params.nomeCliente || '(desconhecido)'}`,
    `Mensagem atual: ${params.mensagem}`,
    linhasHistorico ? `Histórico recente:\n${linhasHistorico}` : '',
    '',
    'Responda SOMENTE com um JSON (sem markdown, sem texto fora dele) exatamente neste formato:',
    '{"achouConta": true, "valorConta": 0, "grupo": "A"}',
    '',
    'Campos:',
    '- achouConta: true apenas se houver dados concretos da conta de energia na conversa.',
    '- valorConta: valor em R$ cobrado na conta (número). Se não houver, null.',
    '- grupo: "A" ou "B" (grupo de consumo da conta). Se não houver, null.',
    'Se não houver conta na conversa, responda: {"achouConta": false, "valorConta": null, "grupo": null}',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Passo completo com a MIMO: chama o modelo (com teto de espera),
 * interpreta e devolve a análise. LANÇA só se a chamada falhar — o
 * chamador trata (nunca derruba a automação de resposta).
 */
export async function analisarContaComIA(params: {
  nomeCliente?: string
  mensagem: string
  historico?: Array<{ remetente: string; conteudo: string }>
  env?: Record<string, string | undefined>
  timeoutMs?: number
}): Promise<AnaliseConta> {
  const prompt = montarPromptClassificacao(params)
  const chamada = chamarModelo(prompt, params.env)
  const texto = await comTempoLimite(chamada, params.timeoutMs ?? 20000)
  return extrairAnalise(texto)
}

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`IA da conta não respondeu em ${ms}ms`)), ms)
    promessa
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(t)
        reject(e)
      })
  })
}
