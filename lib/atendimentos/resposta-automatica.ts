/**
 * M2 (Fase 4) — AUTOMAÇÃO DE RESPOSTA num lugar só.
 *
 * Antes: a ordem "chatbot → IA" estava escrita em 3 blocos (webhook WAHA × 2
 * e webhook Evolution × 2), cada um com sua cópia de leitura de histórico e de
 * envio. Aqui os webhooks passam só:
 *   - tentarChatbot()  (o chatbot deles, já único por arquivo)
 *   - enviar(texto)    (o canal deles: WAHA ou Evolution)
 * e a decisão + o guardrail da base de conhecimento acontecem UMA vez.
 */

import {
  decidirOrdemResposta,
  montarEncaminhamentoIA,
  MENSAGEM_ENCAMINHAMENTO_IA,
  type Responsavel,
} from './orquestrador'
import { verificarIAAtivada, responderComBase } from '../ai-assistant'
import { criarNotificacao } from '../notificacoes'

export interface ParamsAutomacao {
  supabase: any
  telefone: string
  mensagem: string
  instancia: string
  nomeCliente?: string
  atendimentoId: string
  /** Consultado só quando a IA for realmente usada (evita query inútil). */
  buscarHistorico?: () => Promise<Array<{ remetente: string; conteudo: string }>>
  /** Executa o chatbot do webhook; null = chatbot não tratou esta mensagem. */
  tentarChatbot: () => Promise<string | null>
  /** Envia texto no canal do webhook. */
  enviar: (
    texto: string,
  ) => Promise<{ success: boolean; message_id?: string | null; error?: unknown }>
}

export interface ResultadoAutomacao {
  /** action do chatbot quando ele assumiu; null = a resposta não é uma "action". */
  action: string | null
  responsavel: Responsavel
  motivo: string
}

async function gravarNoHistorico(
  supabase: any,
  atendimentoId: string,
  conteudo: string,
  whatsappMessageId?: string | null,
) {
  await supabase.from('atendimento_mensagens').insert({
    atendimento_id: atendimentoId,
    remetente: 'vendedor',
    conteudo,
    enviada_por: null, // automação não é um vendedor específico
    whatsapp_message_id: whatsappMessageId || null,
  })
}

/**
 * Executa a ordem centralizada: chatbot > IA > humano.
 * Nunca lança: erro em qualquer etapa vira "humano assume" com motivo.
 */
export async function executarAutomacao(p: ParamsAutomacao): Promise<ResultadoAutomacao> {
  // ── 1. chatbot ────────────────────────────────────────────────────────
  let action: string | null = null
  try {
    action = await p.tentarChatbot()
  } catch (err: any) {
    console.error('[Automacao] Erro no chatbot:', err?.message)
  }
  if (action) {
    const d = decidirOrdemResposta({ chatbotTrata: true, iaAtivada: false })
    console.log(`[Automacao] chatbot assumiu (${action}) — IA não responde junto`)
    return { action, responsavel: d.responsavel, motivo: d.motivo }
  }

  // ── 2. IA (só se estiver ligada) ─────────────────────────────────────
  const iaAtivada = await verificarIAAtivada(p.supabase)
  const decisao = decidirOrdemResposta({ chatbotTrata: false, iaAtivada })
  if (decisao.responsavel !== 'ia') {
    return { action: null, responsavel: decisao.responsavel, motivo: decisao.motivo }
  }

  const historico = p.buscarHistorico ? await p.buscarHistorico().catch(() => []) : []

  let resultado
  try {
    resultado = await responderComBase({
      mensagemCliente: p.mensagem,
      nomeCliente: p.nomeCliente,
      historico,
      supabase: p.supabase,
    })
  } catch (err: any) {
    console.error('[Automacao] Erro na IA:', err?.message)
    resultado = { texto: null, encaminhar: true, motivo: 'erro_ia' as const }
  }

  if (resultado.texto) {
    const envio = await p.enviar(resultado.texto).catch((e) => ({
      success: false,
      message_id: null,
      error: e?.message ?? String(e),
    }))
    if (envio.success) {
      await gravarNoHistorico(p.supabase, p.atendimentoId, resultado.texto, envio.message_id)
      console.log(`[Automacao] IA respondeu ${p.telefone}: ${resultado.texto.substring(0, 60)}...`)
      return {
        action: null,
        responsavel: 'ia',
        motivo: 'IA respondeu a partir da base de conhecimento',
      }
    }
    console.error('[Automacao] Erro ao enviar resposta da IA:', envio.error)
    return { action: null, responsavel: 'ia', motivo: 'IA gerou resposta mas o envio falhou' }
  }

  // ── 3. guardrail: fora da base → vendedor assume, com registro ───────
  const motivo = resultado.motivo ?? 'sem_resposta'
  console.log(`[Automacao] IA sem resposta (${motivo}) → vendedor assume, telefone ${p.telefone}`)

  const envio = await p.enviar(MENSAGEM_ENCAMINHAMENTO_IA).catch((e) => ({
    success: false,
    message_id: null,
    error: e?.message ?? String(e),
  }))
  if (envio.success) {
    await gravarNoHistorico(p.supabase, p.atendimentoId, MENSAGEM_ENCAMINHAMENTO_IA, envio.message_id)
  }

  await criarNotificacao(
    p.supabase,
    montarEncaminhamentoIA({
      telefone: p.telefone,
      atendimentoId: p.atendimentoId,
      pergunta: p.mensagem,
      motivo,
    }),
  ).catch((e) => console.error('[Automacao] Erro ao registrar encaminhamento:', e?.message))

  return { action: null, responsavel: 'humano', motivo: `IA encaminhou ao vendedor: ${motivo}` }
}
