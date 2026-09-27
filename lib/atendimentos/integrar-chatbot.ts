/**
 * M2 — decisão de ativação do chatbot, num só lugar.
 *
 * Port fiel do `integrarChatbot` do webhook WAHA (que por sua vez é um port
 * fiel do webhook da Evolution). Extraído para os dois webhooks compartilharem
 * a MESMA regra — antes cada arquivo tinha a sua cópia inline.
 *
 * Regras:
 * - sessão ativa → processa (só quando verificarSessaoAtiva, caso do atendimento existente)
 * - sessão concluída/encaminhada → nunca reativa ("already_completed")
 * - sessão cancelada nas últimas 24h → bloqueada ("blocked_cancelled")
 * - fluxo ativo + gatilho (todos | disparo) → inicia/processa
 *
 * Retorna a action ou null se o chatbot não deve responder.
 */

import { processarMensagemChatbot } from '../chatbot/engine'

export async function integrarChatbot(params: {
  supabase: any
  telefone: string
  mensagem: string
  instancia: string
  nomeCliente?: string
  verificarSessaoAtiva: boolean
  /** Fallback de instância quando o fluxo não define uma (era 'STK-3' / 'ROMA_2'). */
  instanciaPadrao?: string
}): Promise<string | null> {
  const { supabase, telefone, mensagem, instancia, nomeCliente, verificarSessaoAtiva } = params

  if (verificarSessaoAtiva) {
    const { data: sessaoChatbot } = await supabase
      .from('chatbot_sessions')
      .select('*')
      .eq('telefone', telefone)
      .eq('status', 'ativa')
      .maybeSingle()

    if (sessaoChatbot) {
      await processarMensagemChatbot(telefone, mensagem, instancia, nomeCliente)
      return 'chatbot'
    }
  }

  // Sessão já finalizada — não reativar
  const { data: sessaoFinalizada } = await supabase
    .from('chatbot_sessions')
    .select('id')
    .eq('telefone', telefone)
    .in('status', ['concluida', 'encaminhada'])
    .limit(1)
    .maybeSingle()

  if (sessaoFinalizada) return 'already_completed'

  // Cancelada nas últimas 24h — não reativar
  const { data: sessaoCancelada } = await supabase
    .from('chatbot_sessions')
    .select('id')
    .eq('telefone', telefone)
    .eq('status', 'cancelada')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle()

  if (sessaoCancelada) return 'blocked_cancelled'

  const { data: fluxoChatbot } = await supabase
    .from('chatbot_flows')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!fluxoChatbot) return null

  // Gatilho: 'disparo' só ativa para números na tabela de gatilho
  let podeAtivar = fluxoChatbot.gatilho === 'todos'
  if (fluxoChatbot.gatilho === 'disparo') {
    const { data: noGatilho } = await supabase
      .from('chatbot_gatilho_numeros')
      .select('id')
      .eq('flow_id', fluxoChatbot.id)
      .eq('telefone', telefone)
      .maybeSingle()
    podeAtivar = !!noGatilho
  }

  if (!podeAtivar) return null

  const resultadoChatbot = await processarMensagemChatbot(
    telefone,
    mensagem,
    instancia || fluxoChatbot.instancia || params.instanciaPadrao || 'STK-3',
    nomeCliente,
  )
  console.log(`[Chatbot] Resultado: ${resultadoChatbot.action}`)
  if (resultadoChatbot.action === 'fora_horario') return 'chatbot_fora_horario'
  return 'chatbot_started'
}
