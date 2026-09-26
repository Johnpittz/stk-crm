/**
 * Parser de eventos do webhook WAHA (docs/plano-implementacao-waha.md Fase 4)
 * Fixtures de referência: lib/__fixtures__/waha-webhook.json
 */

export type TipoMidia = 'image' | 'audio' | 'video' | 'document' | null

export interface MensagemWaha {
  /** Número real do remetente quando o `from` é @lid (SenderAlt etc. no payload) */
  telefone_alt: string | null;
  evento: 'message'
  telefone: string
  /** JID original do remetente (ex.: 123@lid, 5562999990000@c.us) */
  jid: string
  /** true quando o remetente veio como @lid (número real precisa de resolução) */
  de_lid: boolean
  nome: string | null
  conteudo: string
  tipo_midia: TipoMidia
  url_midia: string | null
  file_name: string | null
  midia_erro: string | null
  whatsapp_message_id: string
  from_me: boolean
  grupo: boolean
}

export interface AckWaha {
  evento: 'message.ack'
  whatsapp_message_id: string
  ack: string
  from_me: boolean
}

export interface StatusWaha {
  evento: 'session.status'
  session: string
  status: string
}

export type EventoWaha = MensagemWaha | AckWaha | StatusWaha | { evento: 'ignorado' }

/**
 * Converte o payload do webhook WAHA em um evento normalizado do CRM.
 */
/** Primeira string não vazia da lista (pushName pode vir ''). */
function primeiraString(candidatos: unknown[]): string | null {
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

/**
 * Telefone real do remetente quando `from` é @lid. O payload do GOWS carrega o
 * número em `_data.Info.SenderAlt` (ou variantes flat) — sem depender de API.
 */
function extrairTelefoneAlt(payload: any): string | null {
  const candidatos = [
    payload?._data?.Info?.SenderAlt,
    payload?.senderAlt,
    payload?.fromAlt,
    payload?.participantAlt,
    payload?.remoteJidAlt,
    payload?._data?.SenderAlt,
  ]
  for (const c of candidatos) {
    if (typeof c !== 'string') continue
    // Jid alternativo pode trazer o sufixo de dispositivo ("556295094949:23@…");
    // ele NÃO faz parte do número do cliente (bug 26/09: virava "55629509494923").
    const base = c.split('@')[0].split(':')[0]
    const digitos = base.replace(/\D/g, '')
    if (digitos.length >= 10) return digitos
  }
  return null
}

export function parseEventoWaha(body: unknown): EventoWaha {
  const b = body as any
  if (!b || typeof b !== 'object' || !b.event) {
    return { evento: 'ignorado' }
  }
  const payload = b.payload || {}

  if (b.event === 'message' || b.event === 'message.any') {
    // O CHAT está SEMPRE em `from` (interlocutor ou grupo); `to` é sempre o
    // próprio usuário — trocar por `to` quando fromMe virava "eu" como cliente
    // (bug 23/09: grupo aparecia como Cliente 556234165014).
    const rawFrom: string = payload.from || payload.to || ''
    const media = payload.media || null
    // Canais/newsletters não são clientes — o GOWS emite como mensagem e o
    // Evolution nunca emitia (bug 25/09: "Receitas Fáceis" virou atendimento)
    if (
      rawFrom.endsWith('@newsletter') ||
      typeof payload.type === 'string' && payload.type.startsWith('newsletter') ||
      typeof payload.id === 'string' && payload.id.endsWith('@newsletter')
    ) {
      return { evento: 'ignorado' }
    }
    return {
      evento: 'message',
      telefone: rawFrom.replace(/@(c\.us|s\.whatsapp\.net|g\.us|lid)$/, ''),
      jid: rawFrom,
      de_lid: rawFrom.endsWith('@lid'),
      // PushName pode vir vazio em mensagens de empresa/template; nesse caso o
      // nome verificado (_data.Info.VerifiedName) é a melhor fonte disponível.
      nome: primeiraString([
        payload.pushName,
        payload.pushname,
        payload.notifyName,
        payload._data?.Info?.PushName,
        payload._data?.Info?.VerifiedName?.Details?.verifiedName,
        payload.verifiedName,
      ]),
      telefone_alt: extrairTelefoneAlt(payload),
      conteudo: payload.body || '',
      tipo_midia: payload.hasMedia ? mapTipoMidia(media?.mimetype) : null,
      url_midia: media?.url || null,
      file_name: media?.filename || null,
      midia_erro: media?.error || null,
      whatsapp_message_id: payload.id || '',
      from_me: Boolean(payload.fromMe),
      grupo: rawFrom.endsWith('@g.us'),
    }
  }

  if (b.event === 'message.ack') {
    return {
      evento: 'message.ack',
      whatsapp_message_id: payload.id || '',
      ack: String(payload.ackName || '').toLowerCase(),
      from_me: Boolean(payload.fromMe),
    }
  }

  if (b.event === 'session.status') {
    return {
      evento: 'session.status',
      session: b.session || '',
      status: payload.status || '',
    }
  }

  return { evento: 'ignorado' }
}

/**
 * Mapeia o mimetype para o tipo de mídia do CRM.
 */
function mapTipoMidia(mimetype?: string): TipoMidia {
  if (!mimetype) return 'document'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('audio/')) return 'audio'
  if (mimetype.startsWith('video/')) return 'video'
  return 'document'
}

// ===== Helpers de persistência =====

/**
 * Mapeia o ack_status do WAHA para o checkmark visual do chat (Fase 7).
 * WAHA ackName: ERROR | PENDING | SERVER | DEVICE | READ | PLAYED.
 */
export function mapearCheckmark(ack?: string | null): 'enviando' | 'entregue' | 'lido' | 'erro' {
  switch (ack) {
    case 'read':
    case 'played':
      return 'lido'
    case 'server':
    case 'device':
      return 'entregue'
    case 'error':
      return 'erro'
    default:
      return 'enviando'
  }
}

const MAPA_TIPO_DB: Record<string, string> = {
  image: 'imagem',
  audio: 'audio',
  video: 'video',
  document: 'documento',
}

/**
 * Mapeia o tipo de mídia para o valor aceito pelo CHECK constraint do banco.
 * Constraint (migração 068): 'texto', 'imagem', 'audio', 'documento', 'video', 'sticker'.
 * Tolerante a pt-BR e maiúsculas; valores desconhecidos passam em minúsculas.
 */
export function mapearTipoMidiaDb(tipo: TipoMidia | string | null | undefined): string | null {
  if (!tipo) return null
  const chave = String(tipo).toLowerCase()
  return MAPA_TIPO_DB[chave] || chave
}

/**
 * Monta o conteúdo exibível da mensagem ([tipo] para mídia, texto caso contrário).
 */
export function montarConteudo(msg: MensagemWaha): string {
  return msg.tipo_midia ? `[${msg.tipo_midia}]` : msg.conteudo
}

/** Tokens de placeholder de mídia (WAHA en, banco pt-BR, legado Evolution) após normalização. */
const PLACEHOLDERS_MIDIA = new Set([
  'image', 'imagem', 'audio', 'ptt', 'video', 'document', 'documento', 'sticker', 'figurinha', 'gif',
])

/**
 * true se o conteúdo é um placeholder de mídia ([image], [áudio], [ptt]...) e não uma legenda real.
 * Usado para não renderizar a legenda duplicada dentro da mídia.
 * Texto de verdade entre colchetes (ex.: '[risos] que demais') não é placeholder.
 */
export function ehPlaceholderConteudo(conteudo: string | null | undefined): boolean {
  if (!conteudo) return false
  const m = conteudo.trim().match(/^\[(.+)\]$/)
  if (!m) return false
  const token = m[1].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return PLACEHOLDERS_MIDIA.has(token)
}
