/**
 * IA identifica oportunidades da CONTA (pedido do João, 06/10).
 *
 * Fluxo (disparado a cada mensagem de cliente na conversa):
 *   1. pré-filtro barato (palavra de conta/energia) — sem isso, nada roda;
 *   2. dedup: se o atendimento já tem oportunidade, não duplica;
 *   3. MIMO extrai da conversa {valor da conta, Grupo A/B};
 *   4. regras NO CÓDIGO: > R$ 5.000 → RECIEE (prioridade); Grupo B → GD;
 *   5. cria a oportunidade no funil (etapa "recebeu_conta"), já com produto,
 *      cliente, vendedor e atendimento vinculados + o motivo no histórico
 *      (descrição).
 *
 * Nunca lança: falha de IA/vira `status: erro` e a conversa segue normal.
 */
import { analisarContaComIA, aplicarRegras, mensagemFalaDeConta } from './classificar-conta'

export type ResultadoIdentificacao = {
  status: 'criada' | 'sem_conta' | 'sem_oportunidade' | 'ja_existe' | 'ignorado' | 'erro'
  tipo?: 'reciee' | 'gd'
  motivo?: string
  oportunidadeId?: string
}

export async function identificarOportunidadeDaConta(params: {
  supabase: { from: (tabela: string) => any }
  atendimentoId: string
  telefone: string
  nomeCliente?: string
  mensagem: string
  buscarHistorico?: () => Promise<Array<{ remetente: string; conteudo: string }>>
  env?: Record<string, string | undefined>
}): Promise<ResultadoIdentificacao> {
  const { supabase, atendimentoId } = params

  // 1. pré-filtro — a maioria das mensagens cai aqui e não custa nada
  if (!mensagemFalaDeConta(params.mensagem)) {
    return { status: 'ignorado', motivo: 'Conversa não fala de conta.' }
  }

  // 2. dedup — uma oportunidade por atendimento
  try {
    const { data: existente } = await supabase
      .from('oportunidades')
      .select('id')
      .eq('atendimento_id', atendimentoId)
      .limit(1)
    if (existente && existente.length > 0) {
      return { status: 'ja_existe', motivo: 'Atendimento já tem oportunidade.' }
    }
  } catch {
    /* segue mesmo se a checagem falhar (dupes são aceitáveis vs. travar) */
  }

  // 3. MIMO extrai os dados da conversa
  let analise
  try {
    const historico = params.buscarHistorico
      ? await params.buscarHistorico().catch(() => [])
      : []
    analise = await analisarContaComIA({
      nomeCliente: params.nomeCliente,
      mensagem: params.mensagem,
      historico,
      env: params.env,
    })
  } catch (err: any) {
    console.error('[IdentificarConta] IA falhou:', err?.message)
    return { status: 'erro', motivo: err?.message || 'Falha na IA da conta' }
  }

  if (!analise.achouConta) {
    return { status: 'sem_conta', motivo: 'IA não identificou dados de conta.' }
  }

  // 4. regras no código (nunca confiar no modelo para o limiar)
  const regra = aplicarRegras(analise)
  if (!regra.tipo) {
    return { status: 'sem_oportunidade', motivo: regra.motivo }
  }

  // 5. cria a oportunidade classificada
  try {
    const { data: atendimento } = await supabase
      .from('atendimentos')
      .select('cliente_id, vendedor_id, nome_cliente')
      .eq('id', atendimentoId)
      .maybeSingle()

    const nomeProduto = regra.tipo === 'reciee' ? 'RECIEE' : 'GD'
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id')
      .eq('nome', nomeProduto)
      .eq('ativo', true)
      .limit(1)
    const produtoId = produtos && produtos.length > 0 ? produtos[0].id : null

    const nome = params.nomeCliente || atendimento?.nome_cliente || params.telefone
    const { data: criada, error } = await supabase
      .from('oportunidades')
      .insert({
        titulo: `${nomeProduto} — ${nome}`,
        descricao: `Análise automática da conta (IA): ${regra.motivo}`,
        tipo: regra.tipo,
        produto_id: produtoId,
        etapa: 'recebeu_conta',
        prioridade: 'media',
        cliente_id: atendimento?.cliente_id || null,
        cliente_nome: params.nomeCliente || atendimento?.nome_cliente || null,
        atendimento_id: atendimentoId,
        vendedor_id: atendimento?.vendedor_id || null,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    console.log(
      `[IdentificarConta] oportunidade ${nomeProduto} criada (${atendimentoId}): ${regra.motivo}`,
    )
    return {
      status: 'criada',
      tipo: regra.tipo,
      motivo: regra.motivo,
      oportunidadeId: criada?.id,
    }
  } catch (err: any) {
    console.error('[IdentificarConta] erro ao gravar oportunidade:', err?.message)
    return { status: 'erro', motivo: err?.message || 'Falha ao gravar' }
  }
}
