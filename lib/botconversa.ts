/**
 * Helper para integração com BotConversa (BSP Oficial Meta)
 * 
 * Webhook recebido do BotConversa:
 * - Quando cliente envia mensagem → webhook dispara para nosso endpoint
 * 
 * Envio de mensagens:
 * - Quando vendedor responde no CRM → chamamos a API do BotConversa para enviar
 */

const BOTCONVERSA_API_URL = process.env.BOTCONVERSA_API_URL || "https://new-backend.botconversa.com.br/api/v1";
const BOTCONVERSA_API_KEY = process.env.BOTCONVERSA_API_KEY;

interface EnviarMensagemParams {
  telefone: string;       // formato: +5511999999999
  mensagem: string;
}

interface EnviarMensagemResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

/**
 * Envia mensagem de texto via BotConversa API
 * @returns message_id do BotConversa para rastreamento
 */
export async function enviarMensagemWhatsApp(params: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  const { telefone, mensagem } = params;

  if (!BOTCONVERSA_API_KEY) {
    console.error("[BotConversa] API Key não configurada");
    return { success: false, error: "API Key não configurada" };
  }

  // Limpa telefone e garante formato +55XXXXXXXXXXX
  const telefoneFormatado = formatarTelefone(telefone);

  try {
    const response = await fetch(`${BOTCONVERSA_API_URL}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BOTCONVERSA_API_KEY}`,
      },
      body: JSON.stringify({
        phone_number: telefoneFormatado,
        message: mensagem,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[BotConversa] Erro ao enviar:", response.status, data);
      return { success: false, error: data.message || `HTTP ${response.status}` };
    }

    // O BotConversa retorna o ID da mensagem em data.message_id ou data.id
    const messageId = data.message_id || data.id || null;

    return { success: true, message_id: messageId };
  } catch (err: any) {
    console.error("[BotConversa] Erro ao enviar mensagem:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Formata telefone para o padrão BotConversa: +55XXXXXXXXXXX
 * Aceita formatos: (11) 99999-9999, 11999999999, 5511999999999, +5511999999999
 */
export function formatarTelefone(telefone: string): string {
  // Remove tudo que não é dígito
  let nums = telefone.replace(/\D/g, "");

  // Se começa com 55 (DDI), mantém
  if (!nums.startsWith("55")) {
    nums = "55" + nums;
  }

  // Garante que tem pelo menos 12 dígitos (55 + DDD + 9 dígitos)
  if (nums.length < 12) {
    // Tenta adicionar 9 na frente do número local
    const ddi = nums.substring(0, 2);
    const resto = nums.substring(2);
    nums = ddi + "9" + resto;
  }

  return "+" + nums;
}

/**
 * Formata telefone do BotConversa para o formato limpo (só dígitos)
 */
export function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}