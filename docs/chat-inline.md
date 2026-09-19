# ChatInline — Componente de Chat WhatsApp

> Componente principal de conversas no módulo de atendimento.

## Localização

`components/features/atendimento/chat-inline.tsx`

## Funcionalidades

- Exibição de mensagens (texto, imagem, áudio, vídeo, documento, sticker)
- Envio de mensagens de texto
- Envio de arquivos (imagem, áudio, vídeo, documento)
- Gravação de áudio integrada
- Transferência de atendimento entre vendedores
- Detecção automática de contas de energia (imagens/PDFs)
- **Separadores de data** (estilo WhatsApp)
- Sync com Evolution API ao abrir conversa

## Interface Mensagem

```typescript
interface Mensagem {
  id: string;
  remetente: string;           // "cliente" | "vendedor" | "operador"
  conteudo: string;
  created_at: string;          // ISO timestamp
  enviada_por?: string | null;
  url_audio?: string | null;
  media_url?: string | null;
  media_type?: string | null;  // "image" | "audio" | "video" | "document" | "sticker"
  file_name?: string | null;
  whatsapp_message_id?: string | null;
  media_key?: string | null;
}
```

## Separadores de Data (Fase 15)

### Funções auxiliares

```typescript
// Formata label do separador
formatarDataSeparador(data: string) → "Hoje" | "Ontem" | "dd/mm/aaaa"

// Verifica se duas datas são de dias diferentes
diasDiferentes(a: string, b: string) → boolean
```

### Comportamento

- **Primeira mensagem** → sempre mostra separador
- **Mensagem do mesmo dia** → sem separador
- **Mensagem de dia diferente** → insere separador antes da mensagem
- **Labels**: "Hoje" (mesmo dia), "Ontem" (dia anterior), "dd/mm/aaaa" (mais antigo)

### Visual

- Pill centralizado com `rounded-full bg-white/10 text-white/50`
- Texto `text-[11px] font-medium`
- Padding `px-3 py-1`
- Separador com `py-2` de espaçamento vertical

### Renderização

Cada mensagem é envolvida em `<>...</>` (Fragment) que contém:
1. Separador de data (condicional)
2. Bubble da mensagem (alinhada à esquerda para cliente, direita para vendedor)

## Props

```typescript
interface ChatInlineProps {
  atendimento: Atendimento | null;
  onMarcarResolvido?: (id: string) => void;
  onMensagemEnviada?: () => void;
  onFechar?: () => void;
  instancia?: string;
  instancias?: InstanciaWhatsApp[];
  mensagensExternas?: any[];
}
```

## Fluxo de Dados

```
mensagensExternas (polling da página)
       ↓
  useEffect sincroniza → setMensagens(msgs)
       ↓
  mensagens.map() renderiza com separadores
       ↓
  UI: separador + bubble + timestamp
```

## Dependências

- `createClient` (Supabase)
- `cn` (utility para classNames)
- `renderMidia` (helper interno para mídia)
- `formatarHora` (formatação de horário)
- `AlertaContaDetectada` (componente de alerta)
