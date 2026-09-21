# Buscar Contatos WhatsApp

## Visão Geral

O componente `BuscarContatosWhatsApp` é um modal de busca que permite localizar contatos do WhatsApp diretamente dentro do STK-CRM. Ele se integra com a **Evolution API** para listar contatos da agenda e contatos de grupos, verificar a existência de números no WhatsApp e facilitar a criação de novos atendimentos a partir de um contato selecionado.

O componente é utilizado como um diálogo modais (overlay) que aparece sobre o conteúdo principal, com busca em tempo real via debounce, exibição de resultados com avatar, badges e ação de seleção.

---

## Props e Interface

### Interface `BuscarContatosWhatsAppProps`

| Prop       | Tipo                       | Obrigatória | Descrição                                              |
|------------|----------------------------|-------------|--------------------------------------------------------|
| `open`     | `boolean`                  | Sim         | Controla a visibilidade do modal.                      |
| `onClose`  | `() => void`               | Sim         | Callback chamado ao fechar o modal.                    |
| `onSelect` | `(contact: WhatsAppContact) => void` | Sim | Callback chamado ao selecionar um contato da lista.    |
| `instance` | `string`                   | Não         | Nome da instância WhatsApp da Evolution API (default: `STK-1`). |

### Interface `WhatsAppContact`

```typescript
interface WhatsAppContact {
  id: string;              // Identificador único do contato
  remoteJid: string;       // JID do WhatsApp (ex: 556299190117@s.whatsapp.net)
  pushName: string | null; // Nome exibido pelo contato no WhatsApp
  profilePicUrl: string | null; // URL da foto de perfil
  isSaved: boolean;        // Se o contato está salvo na agenda do usuário
  isGroup: boolean;        // Se o contato é um grupo
  type: string;            // Tipo do contato (contact, group, etc.)
}
```

---

## Funcionalidades

### 1. Busca de Contatos

- **Busca em tempo real**: O campo de input possui debounce de **300ms**, evitando chamadas excessivas à API enquanto o usuário digita.
- **Busca por nome ou número**: A busca filtra contatos por `pushName` (nome) ou `remoteJid` (número/JID), tanto no lado do cliente (Evolution API) quanto na UI.
- **Carregamento inicial**: Ao abrir o modal, todos os contatos disponíveis são carregados automaticamente com limite de 100 resultados.
- **Busca vazia**: Se nenhum termo for digitado, exibe todos os contatos disponíveis.

### 2. Verificação de Números WhatsApp

A função `checkWhatsAppNumbers` da Evolution API permite verificar se números específicos possuem conta ativa no WhatsApp:

- **Endpoint**: `POST /chat/whatsappNumbers/{instance}`
- **Formatação automática**: Números sem código de país recebem automaticamente o prefixo `55` (Brasil).
- **Resposta**: Retorna um array com `number`, `exists` (boolean) e `jid` para cada número verificado.
- **Uso**: Essa função pode ser chamada antes de criar um atendimento para validar se o destinatário tem WhatsApp ativo.

### 3. Criação de Atendimento

Ao clicar em um contato na lista:

1. O callback `onSelect` é chamado com o objeto `WhatsAppContact`.
2. O modal é fechado automaticamente (`onClose`).
3. O campo de busca e a lista de contatos são resetados.
4. O componente pai recebe o contato e pode criar um novo atendimento.

---

## Integração com a Evolution API

### Endpoint: `findContacts`

| Detalhe       | Valor                                                  |
|---------------|--------------------------------------------------------|
| **Método**    | `POST`                                                 |
| **URL**       | `{EVOLUTION_API_URL}/chat/findContacts/{instanceName}` |
| **Fallback**  | `{EVOLUTION_FALLBACK_URL}/chat/findContacts/{instanceName}` |
| **Headers**   | `Content-Type: application/json`, `apikey: {EVOLUTION_API_KEY}` |
| **Body**      | `{ where: {}, limit: number }`                         |

**Comportamento**:

- Busca a URL primária; se falhar (HTTP não-OK), tenta a URL de fallback automaticamente.
- Retorna um array de contatos normalizados com campos padronizados (`id`, `remoteJid`, `pushName`, `profilePicUrl`, `isSaved`, `isGroup`, `type`).
- Se uma string de busca for fornecida, filtra por `pushName` (case-insensitive) e `remoteJid`.

### Endpoint: `checkWhatsAppNumbers`

| Detalhe       | Valor                                                      |
|---------------|------------------------------------------------------------|
| **Método**    | `POST`                                                     |
| **URL**       | `{EVOLUTION_API_URL}/chat/whatsappNumbers/{instanceName}`  |
| **Headers**   | `Content-Type: application/json`, `apikey: {EVOLUTION_API_KEY}` |
| **Body**      | `{ numbers: string[] }` (números formatados)              |

**Comportamento**:

- Formata números automaticamente (adiciona `55` se ausente).
- Retorna `{ number, exists, jid }` para cada número consultado.

### Rota interna da aplicação

O componente `BuscarContatosWhatsApp` consome a rota interna `/api/whatsapp/contacts` (Server Route), que internamente chama `findContacts` da Evolution API. Isso mantém a `EVOLUTION_API_KEY` segura no servidor.

---

## Estados do Componente

O componente gerencia quatro estados visuais:

### 1. **Loading** (Carregando)

- **Quando**: Enquanto a requisição está em andamento.
- **Visual**: Ícone `Loader2` animado (spinner) com texto "Buscando contatos...".
- **Estado interno**: `loading === true`.

### 2. **Erro**

- **Quando**: A requisição falhou (HTTP não-OK, erro de rede, API key ausente).
- **Visual**: Mensagem de erro em vermelho (`text-red-400`).
- **Estado interno**: `error !== null`.

### 3. **Vazio (sem busca)**

- **Quando**: Modal aberto mas nenhum termo de busca digitado e a lista de contatos está vazia.
- **Visual**: Mensagem "Digite para buscar contatos" em cinza.
- **Estado interno**: `contacts.length === 0 && search === ""`.

### 4. **Vazio (com busca)**

- **Quando**: Termo digitado mas nenhum contato corresponde.
- **Visual**: Mensagem "Nenhum contato encontrado" em cinza.
- **Estado interno**: `contacts.length === 0 && search !== ""`.

### 5. **Resultados**

- **Quando**: Contatos encontrados.
- **Visual**: Lista rolável com cards de contato, cada um exibindo:
  - **Avatar**: Foto de perfil ou ícone `UserPlus` padrão.
  - **Nome**: `pushName` ou "Sem nome" como fallback.
  - **Badge "Salvo"**: Se `isSaved === true` (verde).
  - **Badge "Grupo"**: Se `isGroup === true` (roxo).
  - **Número**: Extraído do `remoteJid` (sem o sufixo `@s.whatsapp.net` ou `@lid`).
  - **Ícone de mensagem**: Indica que o contato pode ser selecionado.

---

## Fluxo de Uso

### Fluxo principal

```
┌─────────────────────────────────────────────────┐
│ 1. Componente pai define: open=true, onSelect   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. Modal abre + fetchContacts("") é chamado     │
│    → POST /api/whatsapp/contacts?limit=100      │
│    → Lista completa de contatos é exibida       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. Usuário digita no campo de busca             │
│    → Debounce 300ms                             │
│    → fetchContacts(termo) é chamado             │
│    → Lista é filtrada por nome ou número        │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 4. Usuário clica em um contato                  │
│    → onSelect(contato) é chamado                │
│    → onClose() fecha o modal                    │
│    → Busca e lista são resetados                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 5. Componente pai cria atendimento              │
│    → Usa WhatsAppContact selecionado            │
│    → Cria conversation/atendimento              │
└─────────────────────────────────────────────────┘
```

### Fluxo de verificação de número

```
Número informado → formatarTelefone() → POST /chat/whatsappNumbers/{instance}
                                          ↓
                              { exists: true/false, jid: string }
                                          ↓
                              Número válido? → Criar atendimento
```

---

## Dependências

### Componentes UI

- `Input` — Campo de busca
- `Button` — Não utilizado diretamente (botoes são `<button>` nativos)
- `Badge` — Indicadores "Salvo" e "Grupo"

### Ícones (Lucide)

- `Search` — Ícone no campo de busca
- `Loader2` — Spinner de loading
- `UserPlus` — Avatar padrão quando não há foto de perfil
- `Phone` — Ícone no cabeçalho do modal
- `MessageSquare` — Ícone de ação ao lado de cada contato
- `X` — Botão de fechar modal

### Hooks

- `useState` — Gerencia `search`, `contacts`, `loading`, `error`
- `useCallback` — Memoiza `fetchContacts`
- `useEffect` — Dispara busca com debounce e busca inicial ao abrir
- `useRef` — Referência do input e timer do debounce

---

## Anotações de Implementação

- **Debounce**: Implementado manualmente com `useRef` + `setTimeout` (300ms). O cleanup no `useEffect` garante que timers antigos são cancelados.
- **Autofocus**: O input recebe foco automático 100ms após o modal abrir.
- **Extração de telefone**: A função `extractPhone` remove os sufixos `@s.whatsapp.net` e `@lid` do `remoteJid` para exibir apenas o número.
- **Reset ao fechar**: Ao selecionar ou fechar o modal, `search` e `contacts` são resetados para evitar dados residuais.
- **Limit de resultados**: A busca padrão retorna até 100 contatos.
- **Instância padrão**: Se nenhuma instância for especificada, a Evolution API usa `STK-1` como fallback.
