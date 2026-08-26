/**
 * Helper para integração com Gemini AI
 * 
 * Usa a Google Generative Language API (Gemini)
 * para gerar respostas automáticas no atendimento.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GerarRespostaParams {
  mensagemCliente: string;
  nomeCliente?: string;
  historico?: Array<{ remetente: string; conteudo: string }>;
}

/**
 * Gera resposta da IA usando Gemini
 */
export async function gerarRespostaIA(params: GerarRespostaParams): Promise<string | null> {
  const { mensagemCliente, nomeCliente, historico } = params;

  if (!GEMINI_API_KEY) {
    console.error('[Gemini AI] API Key não configurada');
    return null;
  }

  // Construir contexto com histórico recente (últimas 10 mensagens)
  let contextoHistorico = '';
  if (historico && historico.length > 0) {
    const recentes = historico.slice(-10);
    contextoHistorico = '\n\nHistórico da conversa:\n' + 
      recentes.map(m => `${m.remetente === 'cliente' ? 'Cliente' : 'Atendente'}: ${m.conteudo}`).join('\n');
  }

  const prompt = `Você é um atendente virtual profissional e simpático de uma empresa brasileira. ${nomeCliente ? `O cliente se chama ${nomeCliente}.` : ''}

Sua tarefa é responder mensagens de clientes no WhatsApp de forma natural, educada e útil. Responda SEMPRE em português brasileiro.

Diretrizes:
- Cumprimente o cliente pelo nome quando disponível
- Seja acolhedor e demonstre interesse em ajudar
- Responda de forma completa, explicando quando necessário
- Ofereça próximos passos quando apropriado (ex: "posso verificar isso para você", "vou encaminhar para o time")
- Se não souber algo específico, seja honesto e ofereça ajuda alternativa
- Finalize convidando o cliente a continuar a conversa se precisar de mais alguma coisa
- NÃO use markdown, asteriscos ou formatação especial
- NÃO invente informações que não tem sobre a empresa
- Respostas devem ter entre 2 e 5 frases, adaptando-se à complexidade da pergunta

Mensagem do cliente: ${mensagemCliente}
${contextoHistorico}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini AI] Erro na requisição:', response.status, error);
      return null;
    }

    const data = await response.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      console.error('[Gemini AI] Resposta vazia:', JSON.stringify(data));
      return null;
    }

    return texto.trim();
  } catch (err: any) {
    console.error('[Gemini AI] Erro:', err.message);
    return null;
  }
}

/**
 * Verifica se a IA está ativada no sistema
 */
export async function verificarIAAtivada(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'ia_atendimento')
      .single();

    if (error || !data) return false;
    return data.valor === true || data.valor === 'true';
  } catch {
    return false;
  }
}
