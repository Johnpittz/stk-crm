/**
 * Helper para integração com Evolution API
 * 
 * Substitui o botconversa.ts anterior
 * Base URL: http://localhost:8082 (interno) ou http://2.25.192.248:8080 (externo)
 * API Key: configurada em .env
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8082';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'minha-conexao';

interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
}

interface EnviarMensagemResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

interface EnviarMidiaParams {
  telefone: string;
  mediatype: 'image' | 'audio' | 'video' | 'document';
  mimetype: string;
  media: string; // base64
  fileName?: string;
}

/**
 * Envia mensagem de texto via Evolution API
 * POST /message/sendText/{instance}
 */
export async function enviarMensagemWhatsApp(params: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  const { telefone, mensagem } = params;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          text: mensagem,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio texto:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio texto:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia mídia via Evolution API
 * POST /message/sendMedia/{instance}
 */
export async function enviarMidiaWhatsApp(params: EnviarMidiaParams): Promise<EnviarMensagemResponse> {
  const { telefone, mediatype, mimetype, media, fileName } = params;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          mediatype,
          mimetype,
          media,
          fileName,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio mídia:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio mídia:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia áudio como nota de voz (ptt)
 * POST /message/sendWhatsAppAudio/{instance}
 */
export async function enviarAudioWhatsApp(params: {
  telefone: string;
  audio: string; // base64
}): Promise<EnviarMensagemResponse> {
  const { telefone, audio } = params;

  if (!EVOLUTION_API_KEY) {
    return { success: false, error: 'API Key não configurada' };
  }

  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: telefoneFormatado,
          audio,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro envio áudio:', response.status, data);
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, message_id: data?.key?.id || data?.id || null };
  } catch (err: any) {
    console.error('[Evolution API] Erro envio áudio:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verifica status da instância
 * GET /instance/connectionState/{instance}
 */
export async function verificarStatusInstancia(): Promise<{ connected: boolean; state: string }> {
  if (!EVOLUTION_API_KEY) {
    return { connected: false, state: 'no_api_key' };
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { connected: false, state: 'error' };
    }

    const state = data?.state || data?.instance?.state || 'unknown';
    const connected = state === 'open' || state === 'connected';

    return { connected, state };
  } catch (err: any) {
    console.error('[Evolution API] Erro verificar status:', err.message);
    return { connected: false, state: 'error' };
  }
}

/**
 * Busca mensagens do WhatsApp (simplificado para Evolution API)
 * Com Evolution API, as mensagens são salvas via webhook em tempo real
 * Esta função retorna array vazio - sync não é mais necessário
 */
export async function buscarMensagensSubscriber(telefone: string): Promise<Array<{
  id: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}>> {
  // Com Evolution API + webhook, as mensagens já são salvas no Supabase
  // Não precisa mais buscar na API externa
  console.log('[Evolution API] Sync não necessário - mensagens salvas via webhook');
  return [];
}

/**
 * Formata telefone para padrão Evolution API
 * Remove caracteres não numéricos e adiciona código do país
 */
export function formatarTelefone(telefone: string): string {
  let nums = telefone.replace(/\D/g, '');
  if (!nums.startsWith('55')) {
    nums = '55' + nums;
  }
  return nums;
}

/**
 * Remove formatação do telefone
 */
export function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '');
}
