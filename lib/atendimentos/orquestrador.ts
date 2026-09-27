/**
 * M2 (Fase 4) — ORDEM CENTRALIZADA DE RESPOSTA: chatbot > IA > humano.
 *
 * Antes deste módulo a ordem estava escrita em 3 lugares: webhook WAHA
 * (atendimento existente), webhook WAHA (novo atendimento) e webhook
 * Evolution legado. Duas cópias podiam responder a MESMA mensagem
 * (chatbot + IA), e mudar a ordem exigia 3 edições sincronizadas.
 *
 * Aqui a decisão é UMA função pura, testada; os webhooks só executam.
 */

import type { NovoNotificacao } from '../notificacoes'

export type Responsavel = 'chatbot' | 'ia' | 'humano'

export interface DecisaoOrdem {
  responsavel: Responsavel
  motivo: string
}

/**
 * Quem responde a mensagem? Precedência estrita: chatbot > IA > humano.
 *
 * @param chatbotTrata  true quando há sessão ativa ou fluxo que vai assumir
 * @param iaAtivada     toggle `ia_atendimento` em configuracoes_sistema
 */
export function decidirOrdemResposta(entrada: {
  chatbotTrata: boolean
  iaAtivada: boolean
}): DecisaoOrdem {
  const { chatbotTrata, iaAtivada } = entrada

  if (chatbotTrata) {
    return {
      responsavel: 'chatbot',
      motivo: 'precedência do chatbot (chatbot > IA > humano) — IA não responde junto',
    }
  }
  if (iaAtivada) {
    return { responsavel: 'ia', motivo: 'chatbot não tratou e IA ligada' }
  }
  return { responsavel: 'humano', motivo: 'sem automação: chatbot fora e IA desligada — humano assume' }
}

/** Mensagem enviada ao cliente quando a IA não pôde responder. */
export const MENSAGEM_ENCAMINHAMENTO_IA =
  'Deixa comigo! Vou direcionar para um especialista que vai te ajudar melhor. Um momento...'

export interface EncaminhamentoIA extends NovoNotificacao {
  tipo: 'chatbot'
  dados: Record<string, unknown>
}

/**
 * Registro do motivo (M2, item 2): toda vez que a IA cai no fallback fica
 * visível para o vendedor O QUE o cliente perguntou e POR QUE a base não deu conta.
 *
 * Lança se `motivo` vier vazio — motivo sem registro não é aceito.
 */
export function montarEncaminhamentoIA(entrada: {
  telefone: string
  atendimentoId?: string | null
  pergunta: string
  motivo: string
}): EncaminhamentoIA {
  const { telefone, atendimentoId, pergunta, motivo } = entrada
  if (!motivo || !String(motivo).trim()) {
    throw new Error('encaminhamento_sem_motivo')
  }

  return {
    tipo: 'chatbot',
    titulo: 'IA sem resposta na base de conhecimento',
    mensagem: `A IA não respondeu e o cliente foi para o atendimento manual. Motivo: ${motivo}. Pergunta: "${pergunta}"`,
    dados: {
      telefone,
      atendimento_id: atendimentoId ?? null,
      pergunta,
      motivo,
      origem: 'ia_base_conhecimento',
    },
  }
}
