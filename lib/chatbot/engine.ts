/**
 * Engine do Chatbot Inteligente
 * 
 * State machine que gerencia fluxos de qualificação de leads
 * via WhatsApp. Cada telefone pode ter uma sessão ativa.
 * 
 * Fluxo: Disparo → Cliente Responde → Bot Entra → Qualificação → Lead
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Tipos ───

export interface FlowStep {
  id: string;
  flow_id: string;
  ordem: number;
  chave: string;
  tipo: 'pergunta' | 'decidir' | 'mensagem_ia' | 'classificar' | 'mensagem_final';
  pergunta: string | null;
  opcoes: Array<{ chave: string; texto: string; pontos?: number }> | null;
  redirecionar: Record<string, string> | null;
  usar_ia: boolean;
  campo_resposta: string | null;
  condicao: { chave: string; valor: string } | null;
}

export interface ChatSession {
  id: string;
  telefone: string;
  flow_id: string;
  step_atual: string;
  respostas: Record<string, any>;
  classificacao: string | null;
  status: string;
  instancia: string | null;
  nome_lead: string | null;
  ultimo_contato: string;
}

export interface ChatMessage {
  id?: string;
  session_id: string;
  remetente: 'bot' | 'cliente' | 'ia';
  conteudo: string;
  step_chave: string | null;
}

export interface ProcessMessageResult {
  action: 'bot_responde' | 'encaminhar_vendedor' | 'timeout' | 'sessao_concluida' | 'aguardando' | 'fora_horario';
  mensagem?: string;
  session?: ChatSession;
  classificacao?: string;
  respostas?: Record<string, any>;
}

// ─── Constantes ───

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── Supabase Helper ───

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

// ─── Verificação de Horário Comercial ───

function estaEmHorarioComercial(horarioConfig: any): boolean {
  const agora = new Date();
  // Converter para horário de Brasília (UTC-3)
  const brTz = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diaSemana = brTz.getDay(); // 0=dom, 1=seg, ...
  const hora = brTz.getHours();
  const minuto = brTz.getMinutes();
  const horaAtual = hora * 60 + minuto;

  // Sábado
  if (diaSemana === 6) {
    const sab = horarioConfig?.sabado || "08:00-12:00";
    const [inicio, fim] = sab.split("-").map((h: string) => {
      const [hh, mm] = h.split(":").map(Number);
      return hh * 60 + mm;
    });
    return horaAtual >= inicio && horaAtual <= fim;
  }

  // Domingo
  if (diaSemana === 0) return false;

  // Segunda a Sexta
  const segSex = horarioConfig?.seg_sexta || "08:00-18:00";
  const [inicio, fim] = segSex.split("-").map((h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  });
  return horaAtual >= inicio && horaAtual <= fim;
}

// ─── IA: Interpretação de Resposta Livre ───

async function interpretarRespostaIA(
  pergunta: string,
  respostaCliente: string,
  opcoes: Array<{ chave: string; texto: string }> | null
): Promise<{ chave: string; confianca: number }> {
  if (!GEMINI_API_KEY) {
    // Fallback: tentar match direto
    return matchRespostaOpcoes(respostaCliente, opcoes);
  }

  const opcoesFormatadas = opcoes
    ? opcoes.map(o => `- "${o.chave}": "${o.texto}"`).join('\n')
    : '';

  const prompt = `Você é um interpretador de respostas de chatbot. O cliente respondeu uma pergunta no WhatsApp.

Pergunta: ${pergunta}

${opcoes ? `Opções disponíveis:\n${opcoesFormatadas}` : 'Resposta livre (sem opções predefinidas).'}

Resposta do cliente: "${respostaCliente}"

${opcoes ? `Retorne APENAS a chave da opção que mais se aproxima da resposta do cliente. Se nenhuma opção se aproximar, retorne "nenhuma".` : `Interprete a resposta e retorne um resumo curto (máximo 50 caracteres).`}

Formato de resposta JSON: {"chave": "chave_da_opcao", "confianca": 0.0-1.0}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
      }),
    });

    if (!response.ok) {
      console.error('[Chatbot IA] Erro:', response.status);
      return matchRespostaOpcoes(respostaCliente, opcoes);
    }

    const data = await response.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (texto) {
      // Extrair JSON da resposta
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.chave && parsed.chave !== 'nenhuma') {
          return { chave: parsed.chave, confianca: parsed.confianca || 0.8 };
        }
      }
    }

    return matchRespostaOpcoes(respostaCliente, opcoes);
  } catch (err) {
    console.error('[Chatbot IA] Erro:', err);
    return matchRespostaOpcoes(respostaCliente, opcoes);
  }
}

// ─── Match Simples de Opções ───

function matchRespostaOpcoes(
  resposta: string,
  opcoes: Array<{ chave: string; texto: string }> | null
): { chave: string; confianca: number } {
  if (!opcoes) return { chave: resposta, confianca: 0.5 };

  const respostaLower = resposta.toLowerCase().trim();

  // Tentar match por número (1, 2, 3...)
  const numeroMatch = respostaLower.match(/^(\d+)$/);
  if (numeroMatch) {
    const idx = parseInt(numeroMatch[1]) - 1;
    if (idx >= 0 && idx < opcoes.length) {
      return { chave: opcoes[idx].chave, confianca: 0.9 };
    }
  }

  // Tentar match por texto
  for (const opcao of opcoes) {
    if (respostaLower.includes(opcao.chave.toLowerCase()) ||
        respostaLower.includes(opcao.texto.toLowerCase())) {
      return { chave: opcao.chave, confianca: 0.8 };
    }
  }

  // Tentar match parcial
  for (const opcao of opcoes) {
    const palavrasOpcao = opcao.texto.toLowerCase().split(' ');
    const palavrasResposta = respostaLower.split(' ');
    const intersecao = palavrasOpcao.filter(p => palavrasResposta.includes(p));
    if (intersecao.length >= 2) {
      return { chave: opcao.chave, confianca: 0.6 };
    }
  }

  return { chave: resposta, confianca: 0.3 };
}

// ─── Classificação do Lead ───

function classificarLead(respostas: Record<string, any>): string {
  let pontos = 0;

  // Somar pontos das respostas
  for (const [chave, valor] of Object.entries(respostas)) {
    if (typeof valor === 'object' && valor?.pontos) {
      pontos += valor.pontos;
    }
  }

  // Classificação baseada nos pontos
  if (pontos >= 80) return 'A'; // Muito qualificado
  if (pontos >= 50) return 'B'; // Qualificado
  if (pontos >= 25) return 'C'; // Em nutrição
  return 'D'; // Baixa prioridade
}

// ─── Formatar Mensagem ───

function formatarMensagem(template: string, respostas: Record<string, any>): string {
  let mensagem = template;
  
  // Substituir {{variaveis}}
  for (const [chave, valor] of Object.entries(respostas)) {
    const valorStr = typeof valor === 'object' ? valor.texto || valor.chave || '' : String(valor);
    mensagem = mensagem.replace(new RegExp(`\\{\\{${chave}\\}\\}`, 'g'), valorStr);
  }
  
  return mensagem;
}

// ─── Enviar Mensagem via Evolution API ───

async function enviarMensagem(
  telefone: string,
  mensagem: string,
  instancia: string
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

  console.log(`[Chatbot Engine] Enviando mensagem para ${telefone} via instância ${instancia}`);
  console.log(`[Chatbot Engine] EVOLUTION_API_URL: ${EVOLUTION_API_URL ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}`);
  console.log(`[Chatbot Engine] EVOLUTION_API_KEY: ${EVOLUTION_API_KEY ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}`);

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[Chatbot Engine] Evolution API não configurada nas env vars');
    return { success: false, error: 'Evolution API não configurada' };
  }

  try {
    const url = `${EVOLUTION_API_URL}/message/sendText/${instancia}`;
    console.log(`[Chatbot Engine] POST ${url}`);

    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefone,
          text: mensagem,
        }),
      }
    );

    const data = await response.json();
    
    if (response.ok) {
      console.log(`[Chatbot Engine] ✅ Mensagem enviada com sucesso: ${data.key?.id || data.id}`);
      return { success: true, message_id: data.key?.id || data.id };
    } else {
      console.error(`[Chatbot Engine] ❌ Erro HTTP ${response.status}:`, JSON.stringify(data));
      return { success: false, error: data.message || `Erro HTTP ${response.status}` };
    }
  } catch (err: any) {
    console.error(`[Chatbot Engine] ❌ Erro de conexão:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Delay ───

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Função Principal ───

export async function processarMensagemChatbot(
  telefone: string,
  mensagemCliente: string,
  instancia: string,
  nomeCliente?: string
): Promise<ProcessMessageResult> {
  const supabase = getSupabase();

  // 1. Verificar se já existe sessão ativa
  const { data: sessaoExistente } = await supabase
    .from('chatbot_sessions')
    .select('*')
    .eq('telefone', telefone)
    .eq('status', 'ativa')
    .maybeSingle();

  if (sessaoExistente) {
    return processarRespostaExistente(supabase, sessaoExistente, mensagemCliente);
  }

  // 2. Buscar qualquer fluxo ativo (sem filtrar por instância)
  const { data: fluxo } = await supabase
    .from('chatbot_flows')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fluxo) {
    return { action: 'aguardando' }; // Sem fluxo, ignora
  }

  // 3. Verificar horário comercial
  if (!estaEmHorarioComercial(fluxo.horario_comercial)) {
    return {
      action: 'fora_horario',
      mensagem: 'Obrigado pela mensagem! Nosso time comercial está fora do horário de atendimento. Retornaremos em breve! 😊',
    };
  }

  // 4. Criar nova sessão
  const { data: novaSessao, error: erroSessao } = await supabase
    .from('chatbot_sessions')
    .insert({
      telefone,
      flow_id: fluxo.id,
      step_atual: 'inicio',
      respostas: {},
      status: 'ativa',
      instancia,
      nome_lead: nomeCliente || null,
    })
    .select()
    .single();

  if (erroSessao || !novaSessao) {
    console.error('[Chatbot] Erro ao criar sessão:', erroSessao);
    return { action: 'aguardando' };
  }

  // 5. Buscar primeira etapa
  const { data: primeiraEtapa } = await supabase
    .from('chatbot_flow_steps')
    .select('*')
    .eq('flow_id', fluxo.id)
    .eq('ordem', 1)
    .single();

  if (!primeiraEtapa) {
    return { action: 'aguardando' };
  }

  // 6. Enviar mensagem inicial
  const delayMs = (fluxo.delay_min || 7) * 1000 + Math.random() * ((fluxo.delay_max || 10) - (fluxo.delay_min || 7)) * 1000;
  await delay(delayMs);

  const resultadoEnvio = await enviarMensagem(
    telefone,
    formatarMensagem(fluxo.mensagem_inicial, { nome: nomeCliente || '' }),
    instancia
  );

  if (!resultadoEnvio.success) {
    console.error('[Chatbot] Erro ao enviar mensagem inicial:', resultadoEnvio.error);
    return { action: 'aguardando' };
  }

  // 7. Salvar mensagem do bot
  await supabase.from('chatbot_messages').insert({
    session_id: novaSessao.id,
    remetente: 'bot',
    conteudo: formatarMensagem(fluxo.mensagem_inicial, { nome: nomeCliente || '' }),
    step_chave: 'inicio',
  });

  // 8. Atualizar sessão para primeira etapa
  await supabase
    .from('chatbot_sessions')
    .update({ step_atual: primeiraEtapa.chave })
    .eq('id', novaSessao.id);

  // 9. Enviar primeira pergunta
  await delay(delayMs);
  
  const perguntaFormatada = formatarMensagem(primeiraEtapa.pergunta || '', { nome: nomeCliente || '' });
  const perguntaComOpcoes = primeiraEtapa.opcoes
    ? `${perguntaFormatada}\n\n${primeiraEtapa.opcoes.map((o: any, i: number) => `${i + 1} - ${o.texto}`).join('\n')}`
    : perguntaFormatada;

  const resultadoPergunta = await enviarMensagem(telefone, perguntaComOpcoes, instancia);

  if (resultadoPergunta.success) {
    await supabase.from('chatbot_messages').insert({
      session_id: novaSessao.id,
      remetente: 'bot',
      conteudo: perguntaComOpcoes,
      step_chave: primeiraEtapa.chave,
    });
  }

  return {
    action: 'bot_responde',
    mensagem: perguntaComOpcoes,
    session: novaSessao,
  };
}

// ─── Processar Resposta em Sessão Existente ───

const PALAVRAS_PARADA = ['parar', 'para', 'cancelar', 'sair', 'abortar', 'encerrar', 'não quero', 'nao quero', 'pare', 'stop', 'tchau', 'obrigad', 'acabou', 'chega', 'suficiente', 'não quero mais', 'nao quero mais', 'para de perguntar', 'para de'];

function ehPedidoDeParada(texto: string): boolean {
  const lower = texto.toLowerCase().trim();
  return PALAVRAS_PARADA.some(p => lower.includes(p));
}

async function processarRespostaExistente(
  supabase: SupabaseClient,
  sessao: ChatSession,
  mensagemCliente: string
): Promise<ProcessMessageResult> {
  // 0. Verificar se pediu pra parar
  if (ehPedidoDeParada(mensagemCliente)) {
    await supabase.from('chatbot_sessions').update({ status: 'cancelada' }).eq('id', sessao.id);
    await enviarMensagem(sessao.telefone, 'Tudo bem! Encaminhando para um especialista. Obrigado pelo contato! 😊', sessao.instancia || 'ROMA_2');
    return { action: 'sessao_concluida', session: sessao };
  }

  // 1. Buscar etapa atual
  const { data: etapaAtual } = await supabase
    .from('chatbot_flow_steps')
    .select('*')
    .eq('flow_id', sessao.flow_id)
    .eq('chave', sessao.step_atual)
    .single();

  if (!etapaAtual) {
    return { action: 'sessao_concluida' };
  }

  // 2. Buscar fluxo para configurações
  const { data: fluxo } = await supabase
    .from('chatbot_flows')
    .select('*')
    .eq('id', sessao.flow_id)
    .single();

  // 3. Salvar resposta do cliente
  await supabase.from('chatbot_messages').insert({
    session_id: sessao.id,
    remetente: 'cliente',
    conteudo: mensagemCliente,
    step_chave: etapaAtual.chave,
  });

  // 4. Interpretar resposta
  let chaveResposta: string;
  let confianca: number;

  if (etapaAtual.usar_ia) {
    const interpretacao = await interpretarRespostaIA(
      etapaAtual.pergunta || '',
      mensagemCliente,
      etapaAtual.opcoes
    );
    chaveResposta = interpretacao.chave;
    confianca = interpretacao.confianca;
  } else {
    const match = matchRespostaOpcoes(mensagemCliente, etapaAtual.opcoes);
    chaveResposta = match.chave;
    confianca = match.confianca;
  }

  // 5. Se confiança baixa, pedir para repetir
  if (confianca < 0.4 && etapaAtual.opcoes) {
    const mensagemRepetir = 'Não consegui entender sua resposta. Poderia repetir, por favor?';
    
    const delayMs = (fluxo?.delay_min || 7) * 1000;
    await delay(delayMs);
    
    const resultado = await enviarMensagem(sessao.telefone, mensagemRepetir, sessao.instancia || 'ROMA_2');
    
    if (resultado.success) {
      await supabase.from('chatbot_messages').insert({
        session_id: sessao.id,
        remetente: 'bot',
        conteudo: mensagemRepetir,
        step_chave: etapaAtual.chave,
      });
    }

    return { action: 'bot_responde', mensagem: mensagemRepetir, session: sessao };
  }

  // 6. Salvar resposta nas respostas da sessão
  const novasRespostas = { ...sessao.respostas };
  
  // Se tem opções, salvar objeto completo (chave + texto + pontos)
  if (etapaAtual.opcoes) {
    const opcaoEscolhida = etapaAtual.opcoes.find((o: any) => o.chave === chaveResposta);
    novasRespostas[etapaAtual.chave] = {
      chave: chaveResposta,
      texto: opcaoEscolhida?.texto || chaveResposta,
      pontos: opcaoEscolhida?.pontos || 0,
    };
  } else if (etapaAtual.campo_resposta) {
    novasRespostas[etapaAtual.campo_resposta] = mensagemCliente;
  } else {
    novasRespostas[etapaAtual.chave] = chaveResposta;
  }

  // 7. Atualizar sessão
  await supabase
    .from('chatbot_sessions')
    .update({ respostas: novasRespostas, ultimo_contato: new Date().toISOString() })
    .eq('id', sessao.id);

  // 8. Determinar próximo passo
  let proximaChave: string | null = null;

  if (etapaAtual.redirecionar) {
    // Verificar se é redirecionamento condicional
    if (etapaAtual.redirecionar[chaveResposta]) {
      proximaChave = etapaAtual.redirecionar[chaveResposta];
    } else if (etapaAtual.redirecionar['*']) {
      proximaChave = etapaAtual.redirecionar['*'];
    }
  }

  if (!proximaChave) {
    return { action: 'sessao_concluida', session: sessao };
  }

  // 9. Buscar próxima etapa
  const { data: proximaEtapa } = await supabase
    .from('chatbot_flow_steps')
    .select('*')
    .eq('flow_id', sessao.flow_id)
    .eq('chave', proximaChave)
    .single();

  if (!proximaEtapa) {
    return { action: 'sessao_concluida', session: sessao };
  }

  // 10. Verificar se é classificação
  if (proximaEtapa.tipo === 'classificar') {
    const classificacao = classificarLead(novasRespostas);
    
    await supabase
      .from('chatbot_sessions')
      .update({ classificacao, status: 'concluida' })
      .eq('id', sessao.id);

    // Buscar etapa de mensagem final
    const { data: etapaFinal } = await supabase
      .from('chatbot_flow_steps')
      .select('*')
      .eq('flow_id', sessao.flow_id)
      .eq('chave', 'mensagem_final')
      .single();

    if (etapaFinal?.pergunta) {
      const delayMs = (fluxo?.delay_min || 7) * 1000;
      await delay(delayMs);

      const mensagemFinal = formatarMensagem(etapaFinal.pergunta, novasRespostas);
      const resultado = await enviarMensagem(sessao.telefone, mensagemFinal, sessao.instancia || 'ROMA_2');

      if (resultado.success) {
        await supabase.from('chatbot_messages').insert({
          session_id: sessao.id,
          remetente: 'bot',
          conteudo: mensagemFinal,
          step_chave: 'mensagem_final',
        });
      }
    }

    return {
      action: 'encaminhar_vendedor',
      classificacao,
      respostas: novasRespostas,
      session: sessao,
    };
  }

  // 11. Verificar se é mensagem final
  if (proximaEtapa.tipo === 'mensagem_final') {
    const delayMs = (fluxo?.delay_min || 7) * 1000;
    await delay(delayMs);

    const mensagemFinal = formatarMensagem(proximaEtapa.pergunta || '', novasRespostas);
    const resultado = await enviarMensagem(sessao.telefone, mensagemFinal, sessao.instancia || 'ROMA_2');

    if (resultado.success) {
      await supabase.from('chatbot_messages').insert({
        session_id: sessao.id,
        remetente: 'bot',
        conteudo: mensagemFinal,
        step_chave: 'mensagem_final',
      });
    }

    return { action: 'sessao_concluida', session: sessao };
  }

  // 12. Atualizar sessão para próxima etapa
  await supabase
    .from('chatbot_sessions')
    .update({ step_atual: proximaEtapa.chave })
    .eq('id', sessao.id);

  // 13. Enviar próxima pergunta
  const delayMs = (fluxo?.delay_min || 7) * 1000 + Math.random() * ((fluxo?.delay_max || 10) - (fluxo?.delay_min || 7)) * 1000;
  await delay(delayMs);

  const perguntaFormatada = formatarMensagem(proximaEtapa.pergunta || '', novasRespostas);
  const perguntaComOpcoes = proximaEtapa.opcoes
    ? `${perguntaFormatada}\n\n${proximaEtapa.opcoes.map((o: any, i: number) => `${i + 1} - ${o.texto}`).join('\n')}`
    : perguntaFormatada;

  const resultadoEnvio = await enviarMensagem(sessao.telefone, perguntaComOpcoes, sessao.instancia || 'ROMA_2');

  if (resultadoEnvio.success) {
    await supabase.from('chatbot_messages').insert({
      session_id: sessao.id,
      remetente: 'bot',
      conteudo: perguntaComOpcoes,
      step_chave: proximaEtapa.chave,
    });
  }

  return {
    action: 'bot_responde',
    mensagem: perguntaComOpcoes,
    session: sessao,
  };
}

// ─── Fallback: Mensagem para Vendedor ───

export async function mensagemFallback(
  telefone: string,
  instancia: string,
  motivo: string
): Promise<void> {
  const supabase = getSupabase();

  // Buscar sessão ativa
  const { data: sessao } = await supabase
    .from('chatbot_sessions')
    .select('*')
    .eq('telefone', telefone)
    .eq('status', 'ativa')
    .single();

  if (sessao) {
    // Encaminhar para vendedor
    await supabase
      .from('chatbot_sessions')
      .update({ status: 'encaminhada' })
      .eq('id', sessao.id);

    // Criar notificação para vendedor
    if (sessao.instancia) {
      await supabase.from('notificacoes').insert({
        titulo: 'Lead encaminhado para atendimento manual',
        mensagem: `O lead ${sessao.nome_lead || telefone} foi encaminhado. Motivo: ${motivo}`,
        tipo: 'chatbot',
        lida: false,
      });
    }
  }

  // Enviar mensagem de fallback
  const mensagem = 'Deixa comigo! Vou direcionar para um especialista que vai te ajudar melhor. Um momento...';
  await enviarMensagem(telefone, mensagem, instancia);
}
