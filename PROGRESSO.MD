# CRM ROMA - Progresso do Projeto

> **Arquivo de contexto para agentes IA**
> **Última atualização:** 16/07/2026
> **Deploy atual:** https://crm-roma-romadistribuicao.vercel.app
> **Conta Vercel:** roma-6489 (romadistribuicao) — plano Hobby/Free
> **Conversa atual:** Integração WhatsApp BotConversa ATIVA + Kanban + Etiquetas

---

## 1. Visão Geral

CRM desenvolvido para a empresa ROMA (distribuidora de materiais elétricos). Sistema gerencia vendedores, clientes, vendas, produtos, atendimentos WhatsApp, campanhas e metas. Integração com ERP Millennium.

**Objetivo principal:** Centralizar a gestão comercial e atendimento ao cliente em uma plataforma única.

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14.2.28 (App Router) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui (Dialog, Tabs, Card, Badge, Button, Input, ScrollArea, Select, etc.) |
| Backend | Next.js API Routes (Serverless na Vercel) |
| Banco de Dados | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (JWT Bearer token) |
| Deploy | Vercel (production) — conta roma-6489 (romadistribuicao) |
| ERP Integration | Millennium ERP (NTLM auth, rede interna) |
| WhatsApp API | BotConversa (backend.botconversa.com.br) |

---

## 3. Estrutura de Diretórios

```
crm-roma/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Rotas com layout autenticado
│   │   ├── atendimento/page.tsx  # Tela principal de atendimento (WhatsApp Web)
│   │   ├── kanban/page.tsx       # Kanban de tarefas (rota separada)
│   │   ├── leads/page.tsx        # Fila de leads (gestor pode atribuir/reatribuir)
│   │   ├── clientes/page.tsx     # Lista de clientes
│   │   ├── produtos/page.tsx     # Catálogo de produtos
│   │   ├── vendas/page.tsx       # Vendas
│   │   ├── dashboard/page.tsx    # Dashboard
│   │   ├── campanhas/page.tsx    # Campanhas
│   │   ├── equipes/page.tsx      # Equipes
│   │   └── configuracoes/        # Configurações (perfil, notificações, segurança, aparência)
│   ├── api/                      # API Routes
│   │   ├── atendimentos/route.ts         # CRUD atendimentos
│   │   ├── atendimentos/mensagens/       # Chat de atendimento
│   │   ├── atendimentos/etiquetas/       # CRUD etiquetas de atendimento
│   │   ├── atendimentos/sync/            # Sync mensagens BotConversa (inativo)
│   │   ├── leads/route.ts                # CRUD leads + atribuição/reatribuição
│   │   ├── leads/distribuir/             # Distribuição automática de leads
│   │   ├── vendedores/route.ts           # Lista e cadastro de vendedores
│   │   ├── notificacoes/route.ts         # Notificações
│   │   ├── tarefas/route.ts              # Kanban tarefas
│   │   ├── produtos/route.ts             # Produtos
│   │   ├── produtos/filtros/route.ts     # Filtros de produtos (separado)
│   │   ├── clientes/route.ts             # Clientes
│   │   ├── vendas/route.ts               # Vendas
│   │   ├── oportunidades/route.ts        # Oportunidades
│   │   ├── webhooks/whatsapp/            # Webhook BotConversa (recebe mensagens)
│   │   └── webhooks/millennium/          # Webhook Millennium
│   ├── layout.tsx                # Layout raiz
│   └── login/page.tsx            # Tela de login
├── components/
│   ├── features/                 # Componentes por funcionalidade
│   │   ├── atendimento/          # Kanban, Chat, Lista, ListaLateral, PainelContato, FiltroEtiquetas
│   │   ├── leads/                # (ainda não criado — tudo em leads/page.tsx)
│   │   ├── clientes/             # Modal novo cliente
│   │   ├── configuracoes/        # Modal novo vendedor
│   │   └── vendas/               # Modal nova venda
│   ├── layout/                   # Header, Sidebar (com logo-icon.png)
│   ├── ui/                       # shadcn/ui components
│   └── notificacoes-bell.tsx     # Componente de notificações
├── lib/
│   └── supabase/                 # Clientes Supabase (client.ts, server.ts)
├── public/
│   └── logo-icon.png             # Logo do sistema no sidebar
├── docs/                         # Documentação
└── supabase/migrations/          # Migrations SQL
```

---

## 4. Funcionalidades Implementadas

### 4.1 Atendimento WhatsApp (COMPLETO — INTEGRAÇÃO BOTCONVERSA ATIVA)

**Tela:** `/atendimento`

**Layout WhatsApp Web:**
- **Painel esquerdo (320px):** Lista de conversas com avatar, nome, preview, telefone, hora, **badges de etiquetas**
- **Painel central (flex):** Chat inline — mensagens, input, botão enviar
- **Painel direito (320px):** Painel de contato com dados do cliente + etiquetas (selecionável)
- **Filtros:** Busca por nome/telefone, período de data, **filtro por etiqueta**
- **Polling:** Atualiza lista a cada 15s (sem loading visual)

**Etiquetas de Atendimento (FUNCIONANDO):**
- Tabela `atendimento_etiquetas` com `atendimento_id`, `etiqueta` (UNIQUE)
- API REST: GET, POST, DELETE em `/api/atendimentos/etiquetas`
- **Painel de contato:** Seção "Etiquetas" com busca + vincular/remover
- **Filtro na lista:** Dropdown "Filtrar por etiqueta" no topo da lista de conversas
- **Badges nos cards:** Cards mostram até 3 badges de etiquetas + "+N" se tiver mais
- **Atualização em tempo real:** Quando vincula/remove etiqueta, a lista e o filtro são atualizados

**Etiquetas disponíveis no painel de contato:**
```
Contatos, Em Atendimento,
```

**⚠️ Limitação Importante — Sincronização WhatsApp:**
- **O CRM ENVIA mensagens** via API BotConversa ✅
- **O CRM RECEBE mensagens** via webhook BotConversa ✅
- **O CRM NÃO sincroniza mensagens enviadas pelo dono do número POR FORA do CRM** ❌
- **Solução futura:** Configurar webhook no painel BotConversa para enviar eventos de "mensagem enviada"

**⚠️ Funcionalidades COMENTADAS para MVP:**
- **Oportunidades** — aba comentada
- **Campanhas** — sidebar comentada
- **Vendas** — sidebar comentada (depende Millennium)
- **Sequências, Campos Personalizados** — removidos do painel de contato

#### Integração BotConversa (ATIVA)

**Helper:** `lib/botconversa.ts`

**API BotConversa:**
- **Base URL:** `https://backend.botconversa.com.br/api/v1/webhook`
- **Autenticação:** Header `api-key: {API_KEY}`
- **Enviar mensagem:** `POST /subscriber/{subscriber_id}/send_message/`
- **Body:** `{ "type": "text", "value": "mensagem" }`
- **Buscar subscriber:** `GET /subscriber/get_by_phone/{phone}/`

**⚠️ CUIDADOS:**
1. Domínio é `backend.botconversa.com.br` (NÃO `api.botconversa.com.br`)
2. Header correto é `api-key` (NÃO `Authorization: Bearer`)
3. Body para enviar é `{ type: "text", value: "..." }` (NÃO `{ message: "..." }`)
4. `subscriber_id` é numérico, obtido pelo endpoint `get_by_phone`
5. **NÃO** adicionar "9" no telefone automaticamente

#### Webhook WhatsApp (Recebimento de Mensagens)

**Endpoint:** `POST /api/webhooks/whatsapp`

**Fluxo:**
1. BotConversa envia payload quando cliente envia mensagem
2. Webhook extrai telefone + mensagem de forma flexível (múltiplos formatos)
3. Busca cliente pelo telefone (tolerante a formatos)
4. **Busca atendimento aberto** — busca exata primeiro, depois comparação por **últimos 8 dígitos**
5. Se encontra → atualiza atendimento + insere mensagem
6. Se não encontra → cria novo atendimento + insere mensagem

**Correção de Duplicidade (14/07/2026):**
- Antes: busca exata por telefone causava duplicatas (ex: `556234165014` vs `6234165014`)
- Agora: busca em 2 etapas — exata + tolerante (últimos 8 dígitos)
- Aplicado em: `webhooks/whatsapp/route.ts` E `atendimentos/route.ts` (POST)

#### Notificações (OTIMIZADO — 14/07/2026)

**Componente:** `notificacoes-bell.tsx` (header)

**Bug corrigido (14/07/2026):**
- **Problema:** Dependência cíclica — `fetchNotificacoes` usava `notificacoes` (state) nas dependências do `useCallback`, causando loop infinito de re-renderização → 400+ requests/minuto
- **Solução:** Trocado por `useRef` (`notificacoesIdsRef`) para detectar notificações novas sem dependência circular
- **Resultado:** ~1 request a cada 2 minutos (era centenas por minuto)

**Configuração atual:**
- Polling a cada **120s** (pausa quando aba invisível)
- Badge no sininho com contador vermelho
- Toast flutuante quando chega notificação nova

### 4.2 Kanban de Tarefas (COMPLETO — REFORMULADO EM JULHO/2026)

**Tela:** `/kanban`

**3 Colunas:**
- **"A Fazer"** — Tarefas pendentes
- **"Andamento"** — Tarefas em andamento
- **"Concluído"** — Tarefas concluídas (últimos 7 dias)

**Fluxo do Modal (REFORMULADO 16/07/2026):**

| Coluna | Botões visíveis | O que acontece |
|--------|-----------------|----------------|
| **A Fazer** | ➡️ Andamento | Só move para andamento |
| **Andamento** | ✅ Concluir | Abre modal com: Título, Descrição, Prioridade + Resultado, Observação, Valor (só se Sucesso) |
| **Concluído** | ✏️ Editar | Edita título, descrição, prioridade e valor (se Sucesso) |

**Modal de Conclusão (unificado):**
- **Título** — editável inline
- **Descrição** — textarea editável
- **Prioridade** — dropdown (Baixa, Média, Alta, Urgente)
- **Resultado*** — dropdown fixo com 5 opções:
  - ✅ Sucesso — contato/negociação realizada
  - ❌ Insucesso — não houve interesse
  - 📅 Remarcado — agendado para outro dia
  - 📞 Sem contato — não atendeu
  - 🔄 Follow-up necessário
- **Observação do resultado*** — dropdown fixo com opções por resultado:

| Resultado | Opções de Observação |
|-----------|---------------------|
| Sucesso | Venda fechada, Orçamento enviado, Reunião agendada, Parceria firmada |
| Insucesso | Sem interesse, Preço elevado, Escolheu concorrente, Não é público-alvo |
| Remarcado | Cliente pediu retorno, Agenda lotada, Aguardando decisão |
| Sem contato | Não atendeu, Número inválido, Sem WhatsApp, Caixa postal |
| Follow-up | Enviar orçamento, Confirmar reunião, Verificar disponibilidade, Aguardando retorno |

- **Valor da Venda (R$)*** — aparece APENAS quando resultado = "Sucesso" (formato monetário R$ X.XXX,XX)

**Modal de Edição (apenas Concluído):**
- Edita título, descrição, prioridade
- Se resultado é Sucesso: edita valor da venda

**Coluna `valor_venda` na tabela `tarefas`:**
- Migration `062_tarefas_valor_venda.sql`: `ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(12,2) DEFAULT NULL;`
- API PATCH aceita `valor_venda` no body
- Salva como número decimal, exibe formatado em R$

**Drag and Drop:**
- Usando `@hello-pangea/dnd` (fork do react-beautiful-dnd)
- Arrastar para "Concluído" abre modal de conclusão (não move automaticamente)
- Arrastar para "Andamento" move direto

### 4.3 Painel de Contato (ATUALIZADO 14/07/2026)

**Componente:** `painel-contato.tsx`

- **Dados do contato:** Nome, telefone, email, CPF, data de inscrição
- **Seções removidas (14/07/2026):** Sequências, Campanhas, Campos Personalizados
- **Seção mantida:** Etiquetas (funcional)

### 4.4 Leads / Fila de Leads (COMPLETO)

**Tela:** `/leads`
- Gestor pode atribuir e reatribuir leads
- Distribuição automática entre equipe
- Status: novo → em_atendimento → convertido/descartado

### 4.5 Configurações (COMPLETO)

**Tela:** `/configuracoes`
- Perfil, Notificações, Segurança, Aparência, Vendedores

### 4.6 Dashboard (COMPLETO)

**Tela:** `/dashboard`
- Performance em tempo real (metas, projeções)
- Gráficos e indicadores

### 4.7 Clientes (COMPLETO)

- Lista com busca e filtros
- Modal de cadastro
- Integração com Millennium

### 4.8 Produtos (COMPLETO)

- Catálogo com 2195 produtos
- Paginação (50/página), busca, filtros por marca/categoria/status

### 4.9 Central de Ajuda (COMPLETO)

**Tela:** `/ajuda` — 8 abas com documentação de todas as funcionalidades

---

## 5. APIs Criadas

| Endpoint | Métodos | Descrição |
|----------|---------|-----------|
| `/api/atendimentos` | GET, POST, PATCH | CRUD + simular WhatsApp + transferir + assumir + fechar |
| `/api/atendimentos/mensagens` | GET, POST | Chat de atendimento |
| `/api/atendimentos/etiquetas` | GET, POST, DELETE | CRUD etiquetas de atendimento |
| `/api/atendimentos/sync` | GET | Sync mensagens BotConversa (inativo — API não expõe histórico) |
| `/api/leads` | GET, PATCH | Lista leads + atribuir/reatribuir vendedor |
| `/api/leads/distribuir` | POST | Distribui leads para equipe |
| `/api/vendedores` | GET, POST | Lista todos (service_role bypass RLS) + cadastro |
| `/api/notificacoes` | GET, PATCH, DELETE | Notificações do usuário |
| `/api/tarefas` | GET, POST, PATCH, DELETE | Kanban de tarefas (inclui valor_venda) |
| `/api/produtos` | GET | Produtos paginados |
| `/api/produtos/filtros` | GET | Filtros disponíveis |
| `/api/clientes` | GET, POST | Clientes |
| `/api/vendas` | GET, POST | Vendas |
| `/api/oportunidades` | GET, POST | Oportunidades |
| `/api/webhooks/whatsapp` | POST | Webhook BotConversa (recebe mensagens) |
| `/api/webhooks/millennium` | POST | Webhook do ERP |
| `/api/auth/cadastro` | POST | Cadastro de usuários |
| `/api/promocoes` | GET, POST, PATCH | CRUD promoções |
| `/api/promocoes/clientes` | GET | Clientes que compraram produto da promoção |

---

## 6. Banco de Dados (Supabase)

### 6.1 Tabelas Principais

```sql
profiles              -- Usuários/vendedores
clientes              -- Clientes (com vendedor_responsavel_id)
vendas                -- Vendas
produtos              -- Catálogo de produtos (2195 registros)
tarefas               -- Kanban (coluna_kanban: a_fazer, em_andamento, concluida)
                      -- Inclui: resultado, observacao_resultado, valor_venda
oportunidades         -- Oportunidades de vendas
atendimentos          -- Atendimentos WhatsApp
atendimento_mensagens -- Histórico de chat
atendimento_etiquetas -- Etiquetas vinculadas a atendimentos
notificacoes          -- Notificações
leads                 -- Leads B2B
presenca_vendedor     -- Status online/offline
campanhas             -- Campanhas de marketing
```

### 6.2 Colunas Importantes em `atendimentos`

- `vendedor_id` → FK para profiles (null = fila geral)
- `cliente_id` → FK para clientes
- `telefone_cliente`, `nome_cliente`
- `status`: 'aberto' | 'fechado'
- `nao_lido`: boolean
- `ultima_mensagem_remetente`: 'cliente' | 'vendedor'
- `ultima_mensagem`, `ultima_mensagem_data`
- `transbordado`: boolean

### 6.3 Colunas Importantes em `tarefas`

- `coluna_kanban`: 'a_fazer' | 'em_andamento' | 'concluida'
- `resultado`: 'sucesso' | 'insucesso' | 'remarcado' | 'sem_contato' | 'follow_up_necessario'
- `observacao_resultado`: texto livre (ou opção fixa do dropdown)
- `valor_venda`: NUMERIC(12,2) — valor da venda quando sucesso

### 6.4 Tabela `atendimento_etiquetas`

```sql
CREATE TABLE atendimento_etiquetas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atendimento_id, etiqueta)
);
-- RLS desabilitado, GRANT para service_role e authenticated
```

### 6.5 Triggers

```sql
trg_notificar_atendimento   -- INSERT/UPDATE atendimentos → cria notificação
trg_atualizar_ultima_mensagem -- INSERT mensagem → atualiza atendimento
trg_marcar_lido             -- UPDATE atendimento → reset nao_lido quando vendedor responde
```

### 6.6 Migrations Importantes

| Migration | Descrição | Status |
|-----------|-----------|--------|
| `060_atendimento_etiquetas.sql` | Cria tabela de etiquetas | ✅ Executada |
| `061_fix_etiquetas_grant.sql` | GRANT permissões service_role/authenticated | ✅ Executada |
| `062_tarefas_valor_venda.sql` | Adiciona coluna valor_venda em tarefas | ✅ Executada |

### 6.7 RLS (Row Level Security)

- **Tabelas com RLS ativo:** `notificacoes`, `atendimento_mensagens`, `leads`
- **Tabelas sem RLS:** `atendimento_etiquetas` (desabilitado via migration)
- API usa `service_role` para bypassar RLS quando necessário

---

## 7. Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Duplicidade de atendimentos | Busca exata por telefone (formatações diferentes) | Busca tolerante: compara últimos 8 dígitos |
| Notificações: 400+ requests/minuto | Dependência cíclica no useCallback (state dentro de deps) | Trocado por useRef para IDs |
| Erro 500 ao vincular etiqueta | Tabela sem permissão GRANT | Migration 061 com GRANT ALL |
| Erro 403 ao editar tarefa | PATCH filtrava por vendedor_id | Removido filtro de vendedor no update |
| Tarefa não atualizava após editar | Modal não fechava + lista não recarregava | Adicionado onClose() após salvar |
| Transferência dava erro 500 | PATCH usava client comum (RLS bloqueava) | PATCH usa `service_role` |
| Lentidão na navegação | API de produtos buscava 2195 registros | Endpoint `/api/produtos/filtros` separado |
| Scroll do Kanban cortava último card | maxHeight fixo | flex-1 overflow-y-auto |

---

## 8. Otimização de Performance

### 8.1 Otimizações Implementadas

| Componente | Mudança | Impacto |
|-----------|---------|---------|
| `notificacoes-bell.tsx` | Polling 120s + useRef para evitar loop | De 400+ req/min para ~1 req/2min |
| `chat-inline.tsx` | Polling 30s | -83% invocações |
| `middleware.ts` | Security headers fora do next.config.js | -40% Edge Requests |

### 8.2 Deploy

- **Comando:** `cd crm-roma && npx vercel --prod --force --yes`
- **URL:** https://crm-roma-romadistribuicao.vercel.app
- **Conta Vercel:** roma-6489 (romadistribuicao) — NÃO vincular GitHub

### 8.3 Variáveis de Ambiente (Vercel)

| Variável | Ambiente |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `CNPJ_ABERTO_API_KEY` | Production |
| `BOTCONVERSA_API_KEY` | Production |

---

## 9. Sidebar e Logo

### 9.1 Itens Visíveis na Sidebar

```
[LOGO]                    ← logo-icon.png (sem texto)
├─ 🎧 Atendimento   Ativo
├─ 📋 Kanban
├─ 🎯 Leads
├─ 👥 Clientes
├─ 📦 Produtos
├─ 📊 Dashboard
├─ 👔 Equipes (só gestores)
├───────────────
├─ ⚙️ Configurações
├─ ❓ Ajuda
├─ 👤 Usuário [Logout]
```

### 9.2 Logo

- Arquivo: `public/logo-icon.png`
- Substituiu antigo "R" verde no sidebar
- Sidebar mostra **somente a imagem** (sem texto "CRM ROMA")

---

## 10. Decisões de Simplificação MVP

### 🔴 Funcionalidades COMENTADAS/REMOVIDAS

| Funcionalidade | Status | Para reativar |
|---|---|---|
| **Campanhas** | Comentada na sidebar | Descomentar import + navItem |
| **Oportunidades** | Comentada no atendimento | Descomentar TabsTrigger + import |
| **Vendas** | Comentada na sidebar | Descomentar import + navItem |
| **Sequências** | Removida do painel contato | Re-adicionar componente |
| **Campos Personalizados** | Removida do painel contato | Re-adicionar componente |

### 🟢 WhatsApp — BotConversa (BSP Oficial Meta)

**Status:** ✅ ATIVADO

**Variáveis de ambiente:**
```
BOTCONVERSA_API_KEY=1329cfd1-cf08-405e-9323-2e7c509ef830
BOTCONVERSA_WEBHOOK_ID=195277
BOTCONVERSA_API_URL=https://backend.botconversa.com.br/api/v1/webhook
```

**NOTA:** Soluções não-oficiais (Evolution API, Z-API) foram REJEITADAS por política da empresa.

---

## 11. Convenções de Código

### 11.1 Padrões
- TypeScript em todos os arquivos
- Componentes React: `PascalCase.tsx`
- APIs: `route.ts` (Next.js App Router)
- Hooks custom: `use[Nome].ts`
- Variáveis: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`

### 11.2 Supabase
- **Client-side:** `createClient()` do `@/lib/supabase/client` (respeita RLS)
- **Server-side API:** `createClient()` do `@/lib/supabase/server` (respeita RLS)
- **Service Role:** `createServiceClient(url, key)` do `@supabase/supabase-js` (bypass RLS)

### 11.3 Autenticação nas APIs
- Todas as APIs validam token JWT: `Authorization: Bearer <token>`

### 11.4 Deploy
- **Comando:** `cd crm-roma && npx vercel --prod --force --yes`
- **Sempre usar `--force`** para evitar cache antigo
- **NÃO vincular GitHub** no projeto Vercel (causa bloqueio)

---

## 12. Contexto Importante para Próximo Agente

### 12.1 Ambiente
- **Supabase project:** `otmkukicneotcpkemvcq`
- **Windows CLI:** Usar `cmd /c` para comandos encadeados
- **Security headers:** via `middleware.ts`
- **Rate limiting:** 5/min (cadastro), 30/min (prospecção), 20/min (atendimentos), 60/min (webhooks)

### 12.2 Atendimento — Regras de Negócio
- **Duplicidade:** Busca tolerante por últimos 8 dígitos do telefone
- **Não existe `data_fechamento`** — usa `ultima_mensagem_data`
- **Não existe `vendedor_interagiu`** — usa `ultima_mensagem_remetente === "vendedor"`

### 12.3 Kanban — Regras de Negócio
- **A Fazer → Andamento:** Só move (botão direto)
- **Andamento → Concluído:** Modal unificado com edição + resultado + observação + valor
- **Concluído:** Só permite edição (título, desc, prioridade, valor se sucesso)
- **Campo valor:** Aparece APENAS quando resultado = "sucesso"

### 12.4 Dados de Teste
- **Vendedores:** Raquel, Brenda, Christyan, Gabriel, Jackson, João Pedro, Keila, Murilo
- **Cargos:** vendedor, gerente_comercial, diretor, admin
- **Clientes:** ~61 clientes
- **Produtos:** 2195 produtos

---

## 12.5 Roteamento de Atendimentos WhatsApp ✅ IMPLEMENTADO (28/07/2026)

### Status: ATIVO
- **Vendedor padrão:** Valdean (`da38fd55-bad4-42e8-8616-844530ad052c`)
- **Regra:** Todo atendimento novo (número sem vendedor no cadastro) → atribui automaticamente ao Valdean

### Como funciona
1. Mensagem chega pelo webhook BotConversa
2. Se cliente já tem `vendedor_responsavel_id` no cadastro → usa esse vendedor
3. Se cliente NÃO tem vendedor (ou não existe no cadastro) → usa vendedor padrão da tabela `config_roteamento_whatsapp`
4. Se não há configuração → fica `null` (fila geral)

### Arquivos envolvidos
- `lib/roteamento.ts` — Helper `buscarVendedorPadrao()` com cache de 5 min
- `app/api/webhooks/whatsapp/route.ts` — Consulta vendedor padrão na criação
- `app/api/atendimentos/route.ts` — Consulta vendedor padrão na criação (simulação)
- `supabase/migrations/065_config_roteamento_whatsapp.sql` — Tabela + dados iniciais

### Tabela `config_roteamento_whatsapp`
```sql
CREATE TABLE config_roteamento_whatsapp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_padrao_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Para alterar o vendedor padrão (futuro)
```sql
UPDATE config_roteamento_whatsapp SET vendedor_padrao_id = 'UUID_NOVO' WHERE ativo = true;
```
Ou via interface de configurações (quando implementada).

### Para Rodízio Futuro (quando mais vendedores estiverem usando)
- Adicionar coluna `modo TEXT DEFAULT 'fixo'` ('fixo' ou 'rodizio')
- Adicionar coluna `vendedores_habilitados UUID[]` (array de IDs)
- Adicionar coluna `ultimo_indice INTEGER DEFAULT 0` (para round-robin)
- Lógica no helper: se modo = 'rodizio', distribui round-robin entre habilitados

### ⚠️ NÃO alterar no BotConversa
- Webhook URL permanece a mesma
- API Key permanece a mesma
- Variáveis de ambiente permanecem as mesmas
- O CRM não sabe nem precisa saber o número de destino

---

## 13. Como Continuar

1. **Verificar migration necessária:** Adicionar colunas/tabelas em `supabase/migrations/`
2. **Criar/atualizar API:** Adicionar endpoint em `app/api/`
3. **Criar/atualizar componente:** Adicionar em `components/features/`
4. **Atualizar página:** Modificar `page.tsx` correspondente
5. **Testar local:** `npm run dev`
6. **Deploy:** `cd crm-roma && npx vercel --prod --force --yes`

**Sempre verifique o console do navegador (F12) para erros de API.**

---

## 14. Histórico de Commits Importantes

### 16/07/2026
- [x] Sidebar: logo-icon.png substituiu letra "R" (sem texto)
- [x] Kanban: Modal simplificado — "Concluir" unificado com edição de título/desc/prioridade
- [x] Kanban: Botão "Editar" só aparece para tarefas concluídas
- [x] Kanban: Campo valor aparece só quando resultado = Sucesso
- [x] API tarefas: PATCH aceita titulo, descricao, prioridade, valor_venda
- [x] API tarefas: Removido filtro vendedor_id no update (resolve erro 403)

### 15/07/2026
- [x] Kanban: Opções fixas de observação de resultado (dropdown por tipo)
- [x] Kanban: Campo valor da venda com formatação monetária R$
- [x] Migration 062: `tarefas.valor_venda NUMERIC(12,2)`
- [x] Kanban: Valor visível no modal de detalhes (tarefa concluída com sucesso)
- [x] Kanban: Removido prazo/hora da edição

### 14/07/2026
- [x] Correção de duplicidade de atendimentos (busca tolerante por últimos 8 dígitos)
- [x] Correção de loop de notificações (useRef em vez de state nas dependências)
- [x] Etiquetas: Correção de erro 500 (GRANT permissões)
- [x] Badges de etiquetas nos cards da lista de atendimentos
- [x] Filtro por etiqueta na lista de atendimentos
- [x] Remoção de Sequências, Campanhas, Campos Personalizados do painel de contato