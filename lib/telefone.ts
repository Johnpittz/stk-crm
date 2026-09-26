/**
 * Utilitários de telefone — fonte única do projeto.
 * Unifica a duplicação entre lib/evolution-api.ts e lib/botconversa.ts
 * (docs/busca-contatos-whatsapp.md §8.5).
 */

/**
 * Formata telefone para o padrão das APIs de WhatsApp:
 * remove caracteres não numéricos e adiciona o código do país (55) se ausente.
 * NÃO adiciona o 9 dígito (números fixos antigos não o têm).
 */
export function formatarTelefone(telefone: string): string {
  let nums = telefone.replace(/\D/g, '')
  if (!nums.startsWith('55')) {
    nums = '55' + nums
  }
  return nums
}

/**
 * Remove a formatação do telefone (mantém apenas dígitos).
 */
export function telefoneParaDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

/**
 * Extrai o telefone discável de um JID do WhatsApp (lib/telefone — fonte única).
 * GOWS (WAHA) devolve `@c.us`; Baileys/Evolution devolvem `@s.whatsapp.net`.
 * @lid não resolvido e grupos (@g.us) não são discáveis → null.
 */
export function extrairTelefoneJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  if (jid.includes('@lid') || jid.includes('@g.us')) return null
  const local = jid.split('@')[0]
  return /^\d{8,15}$/.test(local) ? local : null
}

/**
 * Normaliza telefone para o padrão internacional (DDI por COMPRIMENTO):
 * até 11 dígitos = nacional (DDD+número) → prefixa 55; 12+ = já internacional.
 * '' quando não há telefone. Corrige dois bugs latentes dos links existentes:
 * `55${...}` duplicava o DDI, e startsWith('55') confundia DDD 55 (Santa Maria/RS)
 * com DDI.
 */
export function telefoneInternacional(telefone: string | null | undefined): string {
  if (!telefone) return ''
  const digits = telefoneParaDigitos(telefone)
  if (!digits) return ''
  return digits.length <= 11 ? '55' + digits : digits
}

/**
 * Monta a URL wa.me para abrir conversa com o número (com ou sem contato salvo).
 * Retorna '' sem telefone (o botão não renderiza).
 */
export function urlWaMe(telefone: string | null | undefined): string {
  const intl = telefoneInternacional(telefone)
  return intl ? `https://wa.me/${intl}` : ''
}

/**
 * JID sintético (@c.us) para iniciar conversa dentro do CRM a partir de um
 * telefone — round-trip garantido com extrairTelefoneJid().
 * null sem telefone (não há o que conversar).
 */
/** Dados mínimos de uma sessão WAHA para detecção de número interno. */
export interface InstanciaConectavel {
  name: string;
  number?: string | null;
  status?: string | null;
}

/**
 * Se o telefone do atendimento é um dos números conectados no WAHA, devolve a
 * sessão dona. Serve para o badge de "espelho": quando os dois extremos de uma
 * conversa são contas conectadas, o envio de um lado aparece como recebido no
 * outro (entrega real do WhatsApp) — o badge avisa antes de confundir.
 * Só conta sessões ativas (WORKING/STARTED): parada não recebe nada.
 */
export function encontrarInstanciaConectada(
  telefone: string | null | undefined,
  instancias: InstanciaConectavel[] | null | undefined
): InstanciaConectavel | null {
  if (!telefone || !instancias || instancias.length === 0) return null;
  const alvo = telefoneParaDigitos(telefone);
  if (alvo.length < 10) return null;

  for (const inst of instancias) {
    const status = (inst.status || "").toUpperCase();
    if (status !== "WORKING" && status !== "STARTED") continue;
    const num = telefoneParaDigitos(inst.number || "");
    if (!num) continue;
    if (num === alvo) return inst;
    // Número sem DDI (ex.: "6295094949") casa por sufixo — mínimo 10 dígitos
    // para o corte não criar falso positivo em número aleatório.
    if (num.length >= 10 && alvo.endsWith(num)) return inst;
    if (alvo.length >= 10 && num.endsWith(alvo)) return inst;
  }
  return null;
}

export function telefoneParaJid(telefone: string | null | undefined): string | null {
  const intl = telefoneInternacional(telefone)
  return intl ? `${intl}@c.us` : null
}
