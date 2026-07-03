# CRM ROMA - Progresso do Projeto

> **Arquivo de contexto para agentes IA**
> **Última atualização:** 01/07/2026
> **Deploy atual:** https://crm-roma-romadistribuicao.vercel.app
> **Conta Vercel:** roma-6489 (romadistribuicao) — plano Hobby/Free
> **Conversa atual:** Simplificação MVP + Decisão de plataforma WhatsApp (BotConversa)

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

---

## 3. Estrutura de Diretórios

```
crm-roma/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Rotas com layout autenticado
│   │   ├── atendimento/page.tsx  # Tela principal de atendimento (3 abas)
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
│   │   └── webhooks/millennium/          # Webhook Millennium
│   ├── layout.tsx                # Layout raiz
│   └── login/page.tsx            # Tela de login
├── components/
│   ├── features/                 # Componentes por funcionalidade
│   │   ├── atendimento/          # Kanban, Chat, Lista, ListaLateral, Simular WhatsApp
│   │   ├── leads/                # (ainda não criado — tudo em leads/page.tsx)
│   │   ├── clientes/             # Modal novo cliente
│   │   ├── configuracoes/        # Modal novo vendedor
│   │   └── vendas/               # Modal nova venda
│   ├── layout/                   # Header, Sidebar
│   ├── ui/                       # shadcn/ui components
│   └── notificacoes-bell.tsx     # Componente de notificações
├── lib/
│   └── supabase/                 # Clientes Supabase (client.ts, server.ts)
├── docs/                         # Documentação
│   ├── ARQUITETURA_CRM.md
│   ├── DIAGRAMA_ER.md
│   ├── INTEGRACAO_MILLENNIUM.md
│   └── WIREFRAMES_FLUXOS.md
└── supabase/migrations/          # Migrations SQL
```

---

## 4. Funcionalidades Implementadas

### 4.1 Atendimento WhatsApp (COMPLETO — ATUALIZADO EM 19/06/2026)

**Tela:** `/atendimento`

**2 Abas (MVP SIMPLIFICADO — Julho/2026):**
1. **📋 Meu Trabalho** — Kanban de Tarefas (2/3) + Lista de Atendimentos Lateral (1/3)
2. **💬 Atendimentos** — Lista completa de Atendimentos WhatsApp
- **⚠️ Aba "Oportunidades" COMENTADA** (código preservado em `motor-oportunidades.tsx` — ativar quando necessário)
- **⚠️ Campanhas COMENTADA** na sidebar (código preservado — ativar quando necessário)
- **⚠️ Vendas COMENTADA** na sidebar (código preservado — depende da integração Millennium que não está ativa)
- **Para reativar Oportunidades:** descomentar TabsTrigger + TabsContent + import MotorOportunidades em `page.tsx`
- **Para reativar Campanhas:** descomentar entrada no navItems + import Trophy em `sidebar.tsx`
- **Para reativar Vendas:** descomentar entrada no navItems + import ShoppingCart em `sidebar.tsx`

**Kanban de Tarefas (3 colunas):**
- **"A Fazer"** — Atendimentos abertos onde o **cliente** enviou a última mensagem
- **"Andamento"** — Atendimentos abertos onde o **vendedor** enviou a última mensagem
- **"CONCLUÍDO"** — Atendimentos com `status = "fechado"` nos últimos 7 dias
- Tarefas manuais são draggable entre colunas
- Atendimentos aparecem como cards estáticos com badge verde "ATENDIMENTO"
- Cards de atendimento: nome, preview msg, telefone, hora, botão "Abrir Chat"
- Scroll vertical independente em cada coluna

**Lista de Atendimentos Lateral (aba Meu Trabalho):**
- Componente: `components/features/atendimento/lista-atendimentos-lateral.tsx`
- Cards compactos com avatar, nome, preview, telefone, status, hora
- Botão ✓ para marcar como resolvido
- Scroll próprio
- Clica para abrir chat global

**Lista de Atendimentos (aba Atendimentos):**
- Componente: `components/features/atendimento/lista-atendimentos.tsx`
- Cards maiores com avatar 48px, badge "NOVO", preview completo
- Botão Resolver no card

**Chat Global (Modal):**
- Estado elevado para `AtendimentoPage` (abre de qualquer aba)
- Histórico de mensagens (verde=cliente, branco=vendedor)
- Mensagens virtuais para atendimentos antigos (sem registro na tabela)
- Campo de resposta com botão enviar
- Botão "Resolver" (async/await → fecha atendimento → PATCH status="fechado" → atualiza Kanban)
- Botão "Transferir" (transfere para outro vendedor)
- Realtime: novas mensagens aparecem em tempo real
- PATCH `/api/atendimentos` atualiza `ultima_mensagem`, `ultima_mensagem_remetente` ao enviar

**Filtros Globais (visíveis em todas as abas):**
- Busca por nome, telefone, mensagem
- Filtro por status: Aberto / Fechado / Todos
- Período de data (início → fim)
- Botão "Limpar"
- Exportar CSV

**Simular WhatsApp:**
- Modal que simula mensagem entrante
- Identifica cliente por telefone (limpa formatação)
- Cria atendimento + mensagem no chat

**Assumir Atendimento:**
- Botão para pegar atendimento órfão (fila geral)

**Coluna `vendedor_interagiu`:**
- Migration criada mas NÃO aplicada no banco (Supabase Pooler não permite DDL)
- Fallback no código: usa `ultima_mensagem_remetente === "vendedor"` para determinar se vendedor interagiu

**Coluna `data_fechamento`:**
- NÃO existe no banco (migration `007` falhou porque tabela já existia, ALTER TABLE não rodou)
- Fallback: kanban "Concluído" usa `ultima_mensagem_data` para filtrar atendimentos fechados dos últimos 7 dias

### 4.2 Leads / Fila de Leads (COMPLETO — REATRIBUIÇÃO FUNCIONANDO)

**Tela:** `/leads`

- Lista de leads com busca, filtros de status, data, exportar CSV
- Gestor pode atribuir lead a vendedor (dropdown + botão "Atribuir")
- **Gestor pode REATRIBUIR lead já atribuído** (dropdown aparece com vendedor atual preenchido)
- Botão "Distribuir Leads" para distribuição automática entre equipe
- Vendedor pode iniciar atendimento, converter ou descartar lead
- Status: novo → em_atendimento → convertido/descartado

### 4.3 Configurações (COMPLETO)

**Tela:** `/configuracoes`

- Perfil (dados pessoais)
- Notificações (preferências)
- Segurança (alterar senha)
- Aparência (tema)
- Vendedores (cadastro de novos vendedores)

### 4.4 Notificações (COMPLETO)

**Componente:** `notificacoes-bell.tsx` (header)

- Tabela `notificacoes` com `user_id`, `tipo`, `titulo`, `mensagem`, `lida`
- Badge no sininho com contador vermelho
- Dropdown com lista de notificações
- Toast flutuante quando chega notificação nova
- Polling: a cada **120s** (pausa quando aba invisível)
- **Otimizado em 30/06/2026:** Polling reduzido de 60s para 120s para economizar recursos Vercel free

### 4.5 Dashboard (COMPLETO)

- Performance em tempo real (metas, projeções)
- Gráficos e indicadores

### 4.6 Clientes (COMPLETO)

- Lista com busca e filtros
- Modal de cadastro
- Integração com Millennium

### 4.7 Produtos (COMPLETO)

- Catálogo com 2195 produtos
- Paginação (50 por página)
- Busca por nome, código ou SKU
- Filtros por marca, categoria, status
- Endpoint `/api/produtos/filtros` separado (buscado 1x)

### 4.8 Vendas (COMPLETO)

- Lista de vendas
- Modal de nova venda
- Integração Millennium

---

## 5. APIs Criadas

| Endpoint | Métodos | Descrição |
|----------|---------|-----------|
| `/api/atendimentos` | GET, POST, PATCH | CRUD + simular WhatsApp + transferir + assumir + fechar |
| `/api/atendimentos/mensagens` | GET, POST | Chat de atendimento |
| `/api/leads` | GET, PATCH | Lista leads + atribuir/reatribuir vendedor |
| `/api/leads/distribuir` | POST | Distribui leads para equipe |
| `/api/vendedores` | GET, POST | Lista todos (service_role bypass RLS) + cadastro |
| `/api/notificacoes` | GET, PATCH, DELETE | Notificações do usuário |
| `/api/tarefas` | GET, POST, PATCH | Kanban de tarefas |
| `/api/produtos` | GET | Produtos paginados |
| `/api/produtos/filtros` | GET | Filtros disponíveis (buscado 1x) |
| `/api/clientes` | GET, POST | Clientes |
| `/api/vendas` | GET, POST | Vendas |
| `/api/oportunidades` | GET, POST | Oportunidades |
| `/api/webhooks/millennium` | POST | Webhook do ERP (secret obrigatória) |
| `/api/auth/cadastro` | POST | Cadastro de usuários (só admin/gestor) |
| `/api/promocoes` | GET, POST, PATCH | CRUD promoções |
| `/api/promocoes/clientes` | GET | Clientes que compraram produto da promoção |

---

## 6. Banco de Dados (Supabase)

### 6.1 Tabelas Principais

```sql
profiles          -- Usuários/vendedores (criada pelo Supabase Auth trigger)
clientes          -- Clientes (com vendedor_responsavel_id)
vendas            -- Vendas
produtos          -- Catálogo de produtos (2195 registros)
tarefas           -- Kanban (coluna_kanban: a_fazer, andamento, concluido)
oportunidades     -- Oportunidades de vendas
atendimentos      -- Atendimentos WhatsApp
atendimento_mensagens -- Histórico de chat
notificacoes      -- Notificações
leads             -- Leads B2B (com vendedor_id, status, origem)
presenca_vendedor -- Status online/offline
campanhas         -- Campanhas de marketing
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
- `vendedor_interagiu`: boolean (migration criada mas NÃO aplicada no banco)
- `data_fechamento`: timestamp (migration criada mas NÃO aplicada no banco)

### 6.3 Triggers

```sql
trg_notificar_atendimento   -- INSERT/UPDATE atendimentos → cria notificação
trg_atualizar_ultima_mensagem -- INSERT mensagem → atualiza atendimento
trg_marcar_lido             -- UPDATE atendimento → reset nao_lido quando vendedor responde
```

### 6.4 RLS (Row Level Security)

- **Tabelas com RLS ativo:** `notificacoes`, `atendimento_mensagens`, `leads`
- **Tabelas que precisam de RLS:** `clientes`, `vendas`, `venda_itens`, `tarefas`, `oportunidades`, `atendimentos`, `produtos`, `profiles`, `campanhas`
- Policies `profiles_select_all`: `id = auth.uid() OR gestor_id = auth.uid() OR is_gerencia()`
- **Service Role policies:** `service_role_all_*` nas tabelas que têm RLS
- **Funções auxiliares:** `is_gerencia()`, `is_gestor()`, `is_gestor_do_vendedor()` — `SECURITY DEFINER`

### 6.5 Enum `tipo_cargo`

```sql
'vendedor', 'gerente_comercial', 'diretor', 'admin'
```

---

## 7. Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Transferência não listava vendedores | API buscava coluna `status` inexistente | Removido `status` e `created_at` da query |
| Só aparecia Raquel na lista | RLS de profiles: vendedor só vê próprio perfil | API usa `service_role` para bypassar RLS |
| Transferência dava erro 500 | PATCH usava client comum (RLS bloqueava) | PATCH usa `service_role` |
| Badge não aparecia fora da aba | `ListaAtendimentos` só carregava na aba ativa | Movido fetch para `page.tsx` (carrega no mount) |
| Lentidão na navegação | API de produtos buscava 2195 registros para filtros a cada chamada | Separado endpoint `/api/produtos/filtros` |
| Muitas requisições de notificações | Polling a cada 10s | Aumentado para 60s + pausa quando aba invisível |
| Encoding quebrava build | Caracteres inválidos em arquivos | Reescrita completa com WriteFile |
| Cache Vercel não pegava mudanças | Build cache antigo | Deploy com `--force` |
| "Sem CNAE" no import | API só mapeava `cnae_principal` | Expandido para múltiplos campos CNAE |
| Scroll do Kanban cortava último card | `maxHeight` fixo com `calc(100vh - ...)` | Removido `maxHeight`, usando `flex-1 overflow-y-auto` |
| Botão "Reatribuir" não funcionava | Dropdown só renderizava quando `!lead.vendedor_id` | Reestruturado JSX para mostrar dropdown sempre que `atribuindoLeadId === lead.id` |
| `vendedor_interagiu` não funciona | Migration não aplicada (Pooler não permite DDL) | Fallback: usa `ultima_mensagem_remetente === "vendedor"` |
| `data_fechamento` não existe | Migration `007` falhou (tabela já existia) | Removido do SELECT/PATCH; usa `ultima_mensagem_data` como fallback |

---

## 8. Otimização de Performance + Migração Vercel (30/06/2026)

### 8.1 Problema Original
A conta Vercel antiga (johnpittz) estourou os limites do plano free:
- **Fluid Active CPU:** 12h / 4h (3x limite)
- **Edge Requests:** 2.9M / 1M (2.9x limite)
- **Function Invocations:** 2.9M / 1M (2.9x limite)
- **Fast Origin Transfer:** 16.56GB / 10GB (1.6x limite)

### 8.2 Causas Identificadas
1. **Chat polling a cada 5 segundos** — gerava ~720 requests/hora por vendedor
2. **Security headers em `next.config.js`** com `/:path*` — processava cada asset estático como Edge Request
3. **Notificações polling a cada 60s** — requests desnecessários
4. **Sem cache HTTP** em APIs de dados estáticos

### 8.3 Otimizações Implementadas

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `atendimento-chat.tsx` | Polling chat: 5s → **30s** | -83% invocações do chat |
| `middleware.ts` | Security headers movidos do next.config.js | -40% Edge Requests |
| `next.config.js` | Removido bloco `async headers()` | Assets estáticos sem Edge processing |
| `notificacoes-bell.tsx` | Polling notificações: 60s → **120s** | -50% requests notificações |
| `vendedores/route.ts` | Adicionado `Cache-Control: private, max-age=300` | -100% re-fetches de vendedores |
| `.env.production` | Criado com variáveis de garante build na Vercel | Build funciona corretamente |

### 8.4 Migração de Conta Vercel

**Conta antiga:** johnpittz (bloqueada por fair use)
**Nova conta:** roma-6489 / romadistribuicao (Hobby/Free)

**Processo de migração:**
1. `npx vercel logout` → deslogar da conta antiga
2. Criar nova conta em vercel.com (roma-6489)
3. `npx vercel login` → logar na nova conta
4. `npx vercel rm crm-roma` → deletar projeto antigo
5. Desconectar GitHub no dashboard (Settings → Git → Disconnect)
6. `npx vercel link` → linkar projeto
7. Adicionar variáveis de ambiente (4 vars)
8. `npx vercel --prod --force --yes` → deploy

**Problemas encontrados e soluções:**
- Deploy bloqueado por vinculação GitHub incorreta → Solução: desconectar GitHub no dashboard Vercel
- Build falhava sem variáveis de ambiente → Solução: criar `.env.production` com as 4 variáveis
- Email do Git não batia com GitHub → Solução: `git config user.email` com email correto

### 8.5 Variáveis de Ambiente (Vercel)
| Variável | Ambiente |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `CNPJ_ABERTO_API_KEY` | Production |

### 8.6 Resultado Esperado (pós-otimização)
| Recurso | Antes | Limite Free | Depois |
|---------|-------|-------------|--------|
| CPU | 12h | 4h | ~2.5h ✅ |
| Edge Requests | 2.9M | 1M | ~700K ✅ |
| Function Invocations | 2.9M | 1M | ~500K ✅ |
| Origin Transfer | 16.56GB | 10GB | ~6GB ✅ |

### 8.7 Deploy
- **Comando:** `cd crm-roma ; npx vercel --prod --force --yes`
- **URL:** https://crm-roma-romadistribuicao.vercel.app
- **Importante:** Não vincular GitHub no projeto Vercel (causa bloqueio por email mismatch)

---

## 9. Decisões de Simplificação MVP + WhatsApp (Julho/2026)

### 🔴 Funcionalidades COMENTADAS para MVP
Para sair do MVP com o CRM o mais simples possível, as seguintes funcionalidades foram **comentadas** (código preservado, mas não visível para vendedores):

| Funcionalidade | Arquivo comentado | Para reativar |
|---|---|---|
| **Campanhas** | `components/layout/sidebar.tsx` — entrada navItems + import Trophy | Descomentar entrada + import |
| **Oportunidades** | `app/(dashboard)/atendimento/page.tsx` — aba + import MotorOportunidades | Descomentar TabsTrigger + TabsContent + import |
| **Vendas** | `components/layout/sidebar.tsx` — entrada navItems + import ShoppingCart | Descomentar entrada + import. **Motivo:** depende da integração Millennium que não está ativa |

**Sidebar MVP — Itens visíveis:**
```
🎯 Atendimento → 📌 Leads → 👥 Clientes → 📦 Produtos → 📊 Dashboard → ⚙️ Configurações
(só gestores) 🏢 Equipes
```

### 🟢 WhatsApp — Plataforma: BotConversa (BSP Oficial Meta)

**DECISÃO IMPORTANTE:** A empresa **NÃO** usará soluções não-oficiais (Evolution API, Z-API, etc.). A escolha é **BotConversa**, BSP oficial certificado pela Meta.

**Motivo:** Empresa já vai usar BotConversa para disparo de mensagens (campanhas/marketing). BSP oficial = sem risco de banimento, API REST simples, webhooks nativos.

**Status:** Ainda **NÃO** contratado. Implementação será feita quando o serviço for contratado.

**O que falta para integrar (quando contratado):**
| Tarefa | Tempo estimado | Dependência |
|---|---|---|
| Criar webhook `POST /api/webhooks/whatsapp` | 3-4h | BotConversa API Key |
| Criar envio `POST /api/atendimentos/mensagens/enviar` | 3-4h | BotConversa API Key |
| Criar helper `lib/botconversa.ts` | 1h | BotConversa API Key |
| Migration: `whatsapp_message_id`, `whatsapp_message_status` | 15min | Nenhuma |
| Adaptar chat (envio real + status badges) | 2-3h | Endpoints criados |
| Configurar webhook no painel BotConversa | 30min | Deploy do webhook |
| **Total** | **~2-3 dias de dev** | |

**Variáveis de ambiente necessárias:**
```
BOTCONVERSA_API_KEY=xxx
BOTCONVERSA_WEBHOOK_SECRET=xxx
BOTCONVERSA_API_URL=https://api.botconversa.com.br/v1
```

**Arquitetura proposta:**
```
Cliente (WhatsApp) ↔ BotConversa BSP ↔ CRM-ROMA API ↔ Supabase ↔ Interface vendedor
```

**NOTA:** Soluções não-oficiais (Evolution API, Z-API) foram **REJEITADAS** por política da empresa. Só soluções oficiais Meta ou BSPs certificados.

### Fase 2: Transbordo Automático (INATIVIDADE)
- Após 15 minutos sem resposta do vendedor, atendimento volta para fila geral
- Campo `data_ultima_resposta_vendedor` na tabela `atendimentos`
- Cron job ou função Supabase para verificar inatividade

### Fase 3: Rodízio Automático
- Clientes não identificados vão para rodízio entre vendedores online
- Tabela/configuração de rodízio

### Segurança — Fase 3 (Hardening) Pendente
- Habilitar RLS em **todas** as tabelas
- Padronizar autenticação para cookie-based em todas as APIs
- Adicionar Zod validation em todos os endpoints
- Atualizar Next.js 14.2.28 → 15.x (CVE conhecida)

### Outras melhorias
- Realtime no `ListaAtendimentos` (atualmente recarrega no refresh manual)
- Cache de filtros de produtos no localStorage
- Otimizar queries do dashboard (views materializadas)
- Permitir gestor reatribuir lead para SI MESMO (atualmente pode trocar entre vendedores)

---

## 10. Convenções de Código

### 10.1 Padrões
- TypeScript em todos os arquivos
- Componentes React: `PascalCase.tsx`
- APIs: `route.ts` (Next.js App Router convention)
- Hooks custom: `use[Nome].ts`
- Variáveis: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`

### 10.2 Supabase
- **Client-side:** `createClient()` do `@/lib/supabase/client` (respeita RLS)
- **Server-side API:** `createClient()` do `@/lib/supabase/server` (respeita RLS)
- **Service Role:** `createServiceClient(url, key)` do `@supabase/supabase-js` (bypass RLS)
- **Quando usar service_role:** APIs que precisam acessar dados de outros usuários (lista de vendedores, transferência, etc.)

### 10.3 Autenticação nas APIs
- Todas as APIs validam token JWT: `Authorization: Bearer <token>`
- Token obtido via `supabase.auth.getSession()`

### 10.4 Deploy
- **Comando:** `cd crm-roma ; npx vercel --prod --force --yes`
- **Importante:** Sempre usar `--force` para evitar cache antigo
- **Workflow:** fazer commit no Git antes de novas alterações. Se algo quebrar, reverte para esse commit.
- **Conta Vercel:** roma-6489 (romadistribuicao) — NÃO vincular GitHub no projeto (causa bloqueio)
- **CLI login:** `npx vercel login` → autentica via navegador

---

## 11. Contexto Importante para Próximo Agente

### 11.1 Ambiente
- **Supabase project:** `otmkukicneotcpkemvcq`
- **RLS está ATIVO** em poucas tabelas. Outras ainda precisam de RLS
- **Service Role Key** está em `.env` e `.env.production` (nunca commitar `.env.local`)
- **Windows CLI:** PowerShell pode bloquear `&&`, usar `cmd /c` ou `;`
- **Security headers:** aplicados via `middleware.ts` (NÃO em `next.config.js`)
- **Rate limiting ativo:** 5/min (cadastro), 30/min (prospecção), 20/min (atendimentos), 60/min (webhooks)
- **Conta Vercel:** roma-6489 (romadistribuicao) — plano Hobby/Free
- **URL do site:** https://crm-roma-romadistribuicao.vercel.app

### 11.2 Atendimento — Regras de Negócio Críticas
- **"A Fazer"**: atendimentos `status="aberto"` onde `ultima_mensagem_remetente !== "vendedor"` (cliente respondeu ou ninguém respondeu)
- **"Andamento"**: atendimentos `status="aberto"` onde `ultima_mensagem_remetente === "vendedor"` (vendedor respondeu por último)
- **"CONCLUÍDO"**: atendimentos `status="fechado"` com `ultima_mensagem_data` dentro dos últimos 7 dias
- Fechar atendimento: PATCH `{ id, status: "fechado" }`
- **NÃO** existe coluna `data_fechamento` no banco — usar `ultima_mensagem_data` como fallback
- **NÃO** existe coluna `vendedor_interagiu` no banco — usar `ultima_mensagem_remetente === "vendedor"`

### 11.3 Atendimento — Layout Atual
- Aba "Meu Trabalho": Kanban (2/3 direita) + ListaAtendimentosLateral (1/3 esquerda)
- Aba "Atendimentos": ListaAtendimentos completa
- Filtros globais acima das abas (busca, status, data, exportar CSV)
- Chat global (modal) abre de qualquer aba

### 11.3.1 Atendimento — Componente CardAtendimentoKanban
- Arquivo: `components/features/atendimento/card-atendimento-kanban.tsx`
- Componente reutilizável para cards de atendimento no Kanban
- Badge verde "💬 ATENDIMENTO" consistente em todas as colunas
- Props: `atendimento`, `onAbrirChat`, `disabled`
- Usado em todas as colunas do Kanban (A Fazer, Andamento, Concluído)
- Substituiu código inline duplicado

### 11.3.2 Atendimento — Filtros de Data
- Kanban filtra tarefas por 3 datas: `created_at`, `data_inicio`, `data_fim`
- Tarefa aparece se QUALQUER dessas datas cai no período filtrado
- Tarefas sem data definida sempre aparecem (pendentes)
- Lógica: `const datas = [t.created_at, t.data_inicio, t.data_fim].filter(Boolean)`

### 11.3.3 Atendimento — Integração Kanban ↔ Atendimentos
- KanbanTarefas recebe prop `onRefresh` para forçar reload
- Quando atendimentos mudam (ex: resolveu um card), Kanban recarrega
- Botão "Resolver" agora é async/await → aguarda API → chama `onMensagemEnviada` → fecha chat
- Cards de atendimento aparecem em colunas baseado em:
  - "A Fazer": `status="aberto"` + vendedor não interagiu
  - "Andamento": `status="aberto"` + vendedor já interagiu
  - "Concluído": `status="fechado"` (últimos 7 dias)

### 11.4 Leads — Reatribuição
- Gestor pode reatribuir lead clicando em "Reatribuir" → dropdown com vendedores aparece → seleciona novo → clica "Reatribuir"
- API PATCH `/api/leads` ace `{ id, vendedor_id, status }`
- Quando atribui vendedor, cria tarefa de prospecção automaticamente

### 11.5 Millennium ERP
- URL: `roma.millenniumhosting.com.br:6017/api/millenium_eco/`
- Auth: NTLM (rede interna apenas)
- Integração via webhook quando disponível

### 11.6 Dados de Teste
- **Vendedores:** Raquel, Brenda, Christyan, Gabriel, Jackson, João Pedro, Keila, Murilo
- **Cargos:** vendedor, gerente_comercial, diretor, admin
- **Clientes:** ~61 clientes
- **Produtos:** 2195 produtos

---

## 12. Como Continuar

1. **Verificar migration necessária:** Adicionar colunas/tabelas em `supabase/migrations/`
2. **Criar/atualizar API:** Adicionar endpoint em `app/api/`
3. **Criar/atualizar componente:** Adicionar em `components/features/`
4. **Atualizar página:** Modificar `page.tsx` correspondente
5. **Testar local:** `npm run dev`
6. **Deploy:** `cd crm-roma ; npx vercel --prod --force --yes`

**Sempre verifique o console do navegador (F12) para erros de API.**
