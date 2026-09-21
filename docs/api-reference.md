# STK CRM — Referência da API WhatsApp

> Endpoints de integração WhatsApp via Evolution API
> Versão: Setembro 2026
> Base URL: `/api/whatsapp`

---

## Visão Geral

Estas rotas funcionam como proxy entre o frontend (Next.js) e a **Evolution API** (self-hosted na VPS Hostinger). A comunicação com a Evolution API utiliza autenticação via `apikey` header.

**Variáveis de ambiente obrigatórias:**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `EVOLUTION_API_URL` | URL base da Evolution API | `http://2.25.192.248:8080` |
| `EVOLUTION_API_KEY` | Chave de autenticação da API | `sua-api-key` |
| `EVOLUTION_INSTANCE` | Nome da instância padrão | `STK-1` |

---

## 1. Listar Contatos

```
GET /api/whatsapp/contacts
```

Retorna contatos salvos na agenda e contatos de grupos do WhatsApp.

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `search` | string | Não | — | Filtra contatos por nome (`pushName`) ou JID |
| `limit` | number | Não | `100` | Quantidade máxima de contatos (máx. **500**) |
| `instance` | string | Não | `STK-1` | Nome da instância WhatsApp |

### Exemplos de Requisição

```
GET /api/whatsapp/contacts
GET /api/whatsapp/contacts?search=João&limit=50
GET /api/whatsapp/contacts?instance=STK-2&limit=200
```

### Resposta — Sucesso (200)

```json
{
  "success": true,
  "contacts": [
    {
      "id": "abc123",
      "remoteJid": "556299190117@s.whatsapp.net",
      "pushName": "João Silva",
      "profilePicUrl": "https://...",
      "isSaved": true,
      "isGroup": false,
      "type": "contact"
    }
  ],
  "total": 1
}
```

### Campos do Contato

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID interno do contato |
| `remoteJid` | string | JID do WhatsApp (ex: `556299190117@s.whatsapp.net`) |
| `pushName` | string \| null | Nome exibido no WhatsApp |
| `profilePicUrl` | string \| null | URL da foto de perfil |
| `isSaved` | boolean | Se está salvo na agenda |
| `isGroup` | boolean | Se é um grupo |
| `type` | string | Tipo do contato (ex: `contact`) |

### Evolution API Utilizada

```
POST /chat/findContacts/{instance}
```

Envia `{ where: {}, limit }` no body. A busca por `search` é feita em memória, filtrando por `pushName` e `remoteJid`.

---

## 2. Verificar Números

```
POST /api/whatsapp/check-number
```

Verifica se uma lista de números de telefone existe no WhatsApp.

### Body (JSON)

```json
{
  "numbers": ["5562999961553", "556295094949"],
  "instance": "STK-1"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `numbers` | string[] | **Sim** | Array de números de telefone (máx. **20**) |
| `instance` | string | Não | Nome da instância (padrão: `STK-1`) |

### Validações

- `numbers` deve ser um array não vazio
- Máximo de **20** números por requisição
- Números são automaticamente formatados (prefixo `55` adicionado se ausente)

### Resposta — Sucesso (200)

```json
{
  "success": true,
  "results": [
    {
      "number": "5562999961553",
      "exists": true,
      "jid": "5562999961553@s.whatsapp.net"
    },
    {
      "number": "556295094949",
      "exists": false,
      "jid": null
    }
  ]
}
```

### Campos do Resultado

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `number` | string | Número consultado (formatado) |
| `exists` | boolean | Se o número possui WhatsApp |
| `jid` | string \| null | JID do contato (se existir) |

### Evolution API Utilizada

```
POST /chat/whatsappNumbers/{instance}
```

Envia `{ numbers: ["5562..."] }` no body.

---

## 3. Debug (Diagnóstico)

```
GET /api/whatsapp/debug
```

> ⚠️ **Rota temporária** — Exposta para diagnóstico de conexão. Remova ou proteja em produção.

Retorna o estado das variáveis de ambiente e testa a conexão com a Evolution API.

### Resposta (200)

```json
{
  "EVOLUTION_API_URL": {
    "set": true,
    "length": 30,
    "looksLikeUrl": true,
    "host": "2.25.192.248",
    "port": "8080"
  },
  "EVOLUTION_API_KEY": {
    "set": true,
    "length": 32
  },
  "EVOLUTION_INSTANCE": {
    "set": true,
    "value": "STK-1"
  },
  "testUrl": "http://2.25.192.248:8080/instance/fetchInstances",
  "testStatus": 200,
  "testBodyPreview": "[{...}]",
  "instancesFound": 3,
  "instancesNames": ["STK-1", "STK-2", "ROMA_2"]
}
```

### Campos de Diagnóstico

| Campo | Descrição |
|-------|-----------|
| `EVOLUTION_API_URL.set` | Se a variável está definida |
| `EVOLUTION_API_URL.length` | Comprimento do valor |
| `EVOLUTION_API_URL.looksLikeUrl` | Se começa com `http` |
| `EVOLUTION_API_URL.host` | Hostname extraído da URL |
| `EVOLUTION_API_URL.port` | Porta extraída da URL |
| `EVOLUTION_API_KEY.set` | Se a chave está definida |
| `EVOLUTION_API_KEY.length` | Comprimento da chave (valor não exposto) |
| `EVOLUTION_INSTANCE.set` | Se a instância está definida |
| `EVOLUTION_INSTANCE.value` | Nome da instância |
| `testStatus` | Status HTTP da requisição de teste |
| `testBodyPreview` | Primeiros 200 caracteres da resposta |
| `instancesFound` | Quantidade de instâncias encontradas |
| `instancesNames` | Lista de nomes das instâncias |

### Casos de Erro no Teste

| Campo | Quando aparece |
|-------|----------------|
| `testError` | Se a requisição de teste falhou (timeout, rede, etc.) |
| `testStatus` | Código HTTP retornado (ex: 401 = API key inválida) |

### Evolution API Utilizada

```
GET /instance/fetchInstances
```

---

## Respostas de Erro

Todas as rotas seguem o mesmo formato de erro:

```json
{
  "error": "Mensagem descritiva do erro"
}
```

### Códigos de Status

| Status | Descrição |
|--------|-----------|
| `200` | Sucesso |
| `400` | Parâmetros inválidos (limit > 500, array vazio, etc.) |
| `500` | Erro interno ou falha na comunicação com a Evolution API |

### Erros Específicos

| Rota | Erro | Causa |
|------|------|-------|
| `GET /contacts` | `Máximo de 500 contatos por requisição` | `limit` > 500 |
| `GET /contacts` | `API Key não configurada` | `EVOLUTION_API_KEY` não definida |
| `POST /check-number` | `Campo 'numbers' é obrigatório e deve ser um array` | Body ausente ou `numbers` inválido |
| `POST /check-number` | `Máximo de 20 números por requisição` | `numbers.length` > 20 |
| `POST /check-number` | `API Key não configurada` | `EVOLUTION_API_KEY` não definida |

### Erros da Evolution API

Quando a Evolution API retorna erro, a mensagem é propagada diretamente:

| HTTP Status | Significado |
|-------------|-------------|
| `401` | API key inválida ou ausente |
| `404` | Instância não encontrada |
| `500` | Erro interno na Evolution API |

---

## Endpoints da Evolution API Utilizados

| Rota STK-CRM | Endpoint Evolution API | Método | Descrição |
|---------------|----------------------|--------|-----------|
| `GET /contacts` | `POST /chat/findContacts/{instance}` | POST | Lista contatos (agenda + grupos) |
| `POST /check-number` | `POST /chat/whatsappNumbers/{instance}` | POST | Verifica existência de números |
| `GET /debug` | `GET /instance/fetchInstances` | GET | Lista instâncias disponíveis |

### Outros Endpoints (usados por rotas internas)

| Endpoint | Método | Uso no STK-CRM |
|----------|--------|----------------|
| `POST /message/sendText/{instance}` | POST | `enviarMensagemWhatsApp()` — envio de texto |
| `POST /message/sendMedia/{instance}` | POST | `enviarMidiaWhatsApp()` — envio de mídia |
| `POST /message/sendWhatsAppAudio/{instance}` | POST | `enviarAudioWhatsApp()` — envio de áudio |
| `GET /instance/connectionState/{instance}` | GET | `verificarStatusInstancia()` — status da conexão |

---

## Formatação de Telefones

Todos os números são automaticamente formatados antes do envio à Evolution API:

1. Remove caracteres não numéricos (`(`, `)`, `-`, ` `, etc.)
2. Adiciona prefixo `55` (Brasil) se ausente

**Exemplos:**

| Input | Output |
|-------|--------|
| `(62) 99190-117` | `556299190117` |
| `6299190117` | `556299190117` |
| `556299190117` | `556299190117` |

---

## Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `app/api/whatsapp/contacts/route.ts` | Rota de contatos |
| `app/api/whatsapp/check-number/route.ts` | Rota de verificação de números |
| `app/api/whatsapp/debug/route.ts` | Rota de diagnóstico |
| `lib/evolution-api.ts` | Helper com todas as chamadas à Evolution API |
