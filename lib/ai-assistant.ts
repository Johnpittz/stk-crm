/**
 * Helper para integração com Gemini AI
 * 
 * Usa a Google Generative Language API (Gemini)
 * para gerar respostas automáticas no atendimento.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

  const prompt = `Você é um atendente virtual de uma empresa. Responda de forma${nomeCliente ? ` ${nomeCliente}` : ''} profissional, objetiva e amigável em português brasileiro.

Regras:
- Seja direto e útil
- Não invente informações que não tem
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Respostas curtas (máximo 3-4 frases)
- Nunca use markdown ou formatação especial

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
          maxOutputTokens: 200,
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
