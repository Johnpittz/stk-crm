# CRM ROMA - Progresso do Projeto

> **Arquivo de contexto para agentes IA (Kimi)**
> **Última atualização:** 21/05/2026
> **Deploy atual:** https://crm-roma.vercel.app
> **Conversa atual:** Segurança do Sistema + Correções Gerais

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
| UI Components | shadcn/ui (Dialog, Tabs, Card, Badge, Button, Input, ScrollArea, etc.) |
| Backend | Next.js API Routes (Serverless na Vercel) |
| Banco de Dados | Supabase (PostgreSQL + Auth + Realtime) |
| Auth | Supabase Auth (JWT Bearer token) |
| Deploy | Vercel (production) |
| ERP Integration | Millennium ERP (NTLM auth, rede interna) |

---

## 3. Estrutura de Diretórios

```
crm-roma/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Rotas com layout autenticado
│   │   ├── atendimento/page.tsx  # Tela principal de atendimento
│   │   ├── clientes/page.tsx     # Lista de clientes
│   │   ├── produtos/page.tsx     # Catálogo de produtos
│   │   ├── vendas/page.tsx       # Vendas
│   │   ├── dashboard/page.tsx    # Dashboard
│   │   ├── campanhas/page.tsx    # Campanhas
│   │   ├── equipes/page.tsx      # Equipes
│   │   └── configuracoes/        # Configurações (inclui vendedores)
│   ├── api/                      # API Routes
│   │   ├── atendimentos/route.ts         # CRUD atendimentos
│   │   ├── atendimentos/mensagens/       # Chat de atendimento
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
│   │   ├── atendimento/          # Kanban, Agenda, Chat, Lista, Simular WhatsApp
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

### 4.1 Atendimento WhatsApp (COMPLETO)

**Tela:** `/atendimento`

- **Kanban de Tarefas:** Colunas "A Fazer", "Andamento", "Concluído" (agora vazio, reservado para tarefas manuais futuras)
- **Agenda do Dia:** Tarefas do dia com horários
- **Motor de Oportunidades:** Oportunidades de vendas
- **Lista de Atendimentos:** Estilo WhatsApp com cards
  - Avatar verde = não lido, badge "NOVO", nome em negrito
  - Preview "Cliente:" ou "Você:" com check verde
  - Badge de contador de não lidos na aba "Atendimentos"
- **Chat de Atendimento (Modal):**
  - Histórico de mensagens (verde=cliente, branco=vendedor)
  - Campo de resposta com botão enviar
  - Botão "Resolver" (fecha atendimento)
  - Botão "Transferir" (transfere para outro vendedor)
  - Realtime: novas mensagens aparecem em tempo real
- **Simular WhatsApp:** Modal que simula mensagem entrante
  - Identifica cliente por telefone (limpa formatação)
  - Busca nos primeiros 6 dígitos com `ilike`, depois compara no JS
  - Cria atendimento + mensagem no chat
- **Assumir Atendimento:** Botão para pegar atendimento órfão (fila geral)
- **Transferência Manual:**
  - Seleciona vendedor de lista (exclui usuário logado)
  - PATCH `/api/atendimentos` com `vendedor_id`
  - Atualiza tarefa no kanban (via trigger), notifica destino
  - Atendimento some da tela do remetente

### 4.2 Notificações (COMPLETO)

**Componente:** `notificacoes-bell.tsx` (header)

- Tabela `notificacoes` com `user_id`, `tipo`, `titulo`, `mensagem`, `lida`
- Trigger `trg_notificar_atendimento` cria notificação no INSERT/UPDATE de atendimentos
- Badge no sininho com contador vermelho
- Dropdown com lista de notificações
- Toast flutuante quando chega notificação nova
- Som de alerta (base64 audio)
- Polling: a cada 60s (pausa quando aba invisível)
- Realtime via Supabase channel

### 4.3 Dashboard (COMPLETO)

- Performance em tempo real (metas, projeções)
- Gráficos e indicadores

### 4.4 Clientes (COMPLETO)

- Lista com busca e filtros
- Modal de cadastro
- Integração com Millennium (dados sincronizados)

### 4.5 Produtos (COMPLETO)

- Catálogo com 2195 produtos
- Paginação (50 por página)
- Busca por nome, código ou SKU
- Filtros por marca, categoria, status
- **Otimização:** endpoint `/api/produtos/filtros` separado (buscado 1x)

### 4.6 Vendas (COMPLETO)

- Lista de vendas
- Modal de nova venda
- Integração Millennium

### 4.7 Configurações > Vendedores (COMPLETO)

- Lista todos os profiles (usuários Supabase)
- Cadastro de novo vendedor (cria conta Supabase Auth)
- Verificação de cargo de gerência para cadastro

### 4.8 Prospecção Inteligente B2B (NOVO)

**Tela:** `/prospeccao`

- **Busca por CNAE + UF:** Integração com APIs de dados públicos (CNPJota, CNPJ Aberto)
- **CNAE free input:** Campo de texto livre + 8 badges de presets (instalação elétrica BT/AT, incorporação, obras alvenaria, alarme, mat. elétrico, transformadores, varejo)
- **Busca nacional:** Sem filtro de UF, busca todas as 27 UFs em batches de 5 com retry (3 tentativas, backoff crescente)
- **Seleção e Importação:** Checkbox para selecionar empresas e importar em lote
- **Criação automática no CRM:**
  - Cliente com status `prospect` e `tipo = 'pj'`
  - Canal de origem = "Prospecção B2B"
  - Tarefa de ligação no Kanban do vendedor
  - Notificação para o vendedor
- **Atribuição a vendedor:** Gestores podem atribuir leads a qualquer vendedor
- **Dedup automática:** Verifica CNPJ antes de importar
- **Log de importações:** Tabela `prospeccao_importacoes` rastreia quem importou o quê
- **Fix CNAE no import:** Mapeia campos `cnae`, `cnae_fiscal`, `cnae_fiscal_principal`, `cnae_principal` e descrições

**APIs:**
- `GET /api/prospeccao?cnae=&uf=&cidade=&limite=` — busca empresas na fonte externa (autenticada, rate limit 30/min)
- `POST /api/prospeccao` — importa empresas selecionadas (cliente + tarefa + notificação)

---

## 5. APIs Criadas

| Endpoint | Métodos | Descrição |
|----------|---------|-----------|
| `/api/atendimentos` | GET, POST, PATCH | CRUD + simular WhatsApp + transferir + assumir |
| `/api/atendimentos/mensagens` | GET, POST | Chat de atendimento |
| `/api/vendedores` | GET, POST | Lista todos (service_role bypass RLS) + cadastro |
| `/api/notificacoes` | GET, PATCH, DELETE | Notificações do usuário |
| `/api/tarefas` | GET, POST, PATCH | Kanban de tarefas |
| `/api/produtos` | GET | Produtos paginados |
| `/api/produtos/filtros` | GET | Filtros disponíveis (buscado 1x) |
| `/api/clientes` | GET, POST | Clientes |
| `/api/vendas` | GET, POST | Vendas |
| `/api/oportunidades` | GET, POST | Oportunidades |
| `/api/prospeccao` | GET, POST | Prospecção inteligente B2B por CNAE |
| `/api/equipes` | GET | Equipes |
| `/api/webhooks/millennium` | POST | Webhook do ERP (secret obrigatória) |
| `/api/auth/cadastro` | POST | Cadastro de usuários (só admin/gestor) |
| `/api/leads/distribuir` | POST | Distribui leads para equipe |

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
atendimentos      -- Atendimentos WhatsApp (com nao_lido, ultima_mensagem_remetente)
atendimento_mensagens -- Histórico de chat
notificacoes      -- Notificações
presenca_vendedor -- Status online/offline
campanhas         -- Campanhas de marketing
prospeccao_importacoes -- Log de importações de prospecção B2B
```

### 6.2 Colunas Importantes em `atendimentos`

- `vendedor_id` → FK para profiles (null = fila geral)
- `cliente_id` → FK para clientes
- `telefone_cliente`, `nome_cliente`
- `status`: 'aberto' | 'fechado'
- `nao_lido`: boolean (indicador visual na lista)
- `ultima_mensagem_remetente`: 'cliente' | 'vendedor'
- `transbordado`: boolean
- `data_transbordo`: timestamp

### 6.3 Triggers

```sql
trg_notificar_atendimento   -- INSERT/UPDATE atendimentos → cria notificação
trg_atualizar_ultima_mensagem -- INSERT mensagem → atualiza atendimento
trg_marcar_lido             -- UPDATE atendimento → reset nao_lido quando vendedor responde
trg_notificar_tarefa_prospeccao -- INSERT tarefas com título 'Prospecção:%' → notifica vendedor
```

### 6.4 RLS (Row Level Security)

- **Tabelas com RLS ativo:** `notificacoes`, `atendimento_mensagens`, `prospeccao_importacoes`, `leads`
- **Tabelas que precisam de RLS:** `clientes`, `vendas`, `venda_itens`, `tarefas`, `oportunidades`, `atendimentos`, `produtos`, `profiles`, `campanhas`, `webhooks_recebidos`
- Policies `profiles_select_all`: `id = auth.uid() OR gestor_id = auth.uid() OR is_gerencia()`
- **Service Role policies:** `service_role_all_*` nas tabelas que têm RLS, para bypass via API REST
- **Funções auxiliares:** `is_gerencia()`, `is_gestor()`, `is_gestor_do_vendedor()` — todas `SECURITY DEFINER`

### 6.5 Enum `tipo_cargo`

```sql
'vendedor', 'gerente_comercial', 'diretor', 'admin'
```

---

## 7. Auditoria de Segurança (Maio/2026)

Documentação completa: `DOCUMENTACAO_SEGURANCA/AUDITORIA_SEGURANCA_CRM.md`

### Correções aplicadas

| Fase | Correção | Status |
|---|---|---|
| 🔴 F1 | Webhook Millennium — secret obrigatória (fail-closed) | ✅ |
| 🔴 F1 | `GET /api/produtos` e `/api/produtos/filtros` — exige autenticação | ✅ |
| 🔴 F1 | `GET /api/prospeccao` — exige autenticação | ✅ |
| 🔴 F1 | `POST /api/atendimentos` — exige autenticação | ✅ |
| 🔴 F1 | `POST /api/auth/cadastro` — só admin/diretor/gerente pode criar usuários | ✅ |
| 🔴 F1 | Senhas hardcoded removidas dos scripts (`node/`, `scripts/`) | ✅ |
| 🟠 F2 | Busca SQL injection fix — caracteres `%` e `_` escapados em leads/produtos | ✅ |
| 🟠 F2 | Ownership check em PATCH/DELETE tarefas, oportunidades, atendimentos, leads | ✅ |
| 🟠 F2 | `GET /api/vendas` — vendedor comum só vê suas vendas | ✅ |
| 🟠 F2 | `GET /api/vendedores` — só gestores veem lista completa | ✅ |
| 🟡 F3 | Security headers (X-Frame-Options, HSTS, CSP, etc.) | ✅ |
| 🟡 F3 | Rate limiting nos endpoints críticos | ✅ |
| 🟡 F3 | Console.logs removidos das APIs | ✅ |

### Pendente
- RLS em todas as tabelas
- Padronizar auth cookie-based
- Zod validation nos endpoints
- Upgrade Next.js 14.2.28 → 15.x

---

## 8. Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Transferência não listava vendedores | API `/api/vendedores` buscava coluna `status` inexistente | Removido `status` e `created_at` da query |
| Só aparecia Raquel na lista | RLS de profiles: vendedor só vê próprio perfil | API usa `service_role` para bypassar RLS |
| Transferência dava erro 500 | PATCH usava client comum (RLS bloqueava) | PATCH usa `service_role` |
| Lista de vendedores duplicada | Lista renderizada no header E no conteúdo | Removido lista do header, deixou só no conteúdo |
| Raquel aparecia na lista | Não filtrava usuário logado | Adicionado `v.id !== userId` |
| Badge não aparecia fora da aba | `ListaAtendimentos` só carregava na aba ativa | Movido fetch para `page.tsx` (carrega no mount) |
| Lentidão na navegação | API de produtos buscava 2195 registros para filtros a cada chamada | Separado endpoint `/api/produtos/filtros` |
| Muitas requisições de notificações | Polling a cada 10s | Aumentado para 60s + pausa quando aba invisível |
| Encoding quebrava build | Caracteres inválidos em arquivos | Reescrita completa com WriteFile |
| Cache Vercel não pegava mudanças | Build cache antigo | Deploy com `--force` |
| Filtros "Por Vendedor" sumiam | Filtros dentro do bloco condicional `vendedorFiltro` | Movidos para fora, sempre visíveis |
| "Sem CNAE" no import | API só mapeava `cnae_principal` | Expandido para `cnae`, `cnae_fiscal`, `cnae_fiscal_principal`, `cnae_principal` + descrições |
| "Por Vendedor" não carregava | useEffect não incluía `activeTab === "por_vendedor"` | Adicionado ao trigger de busca |
| Gestor via leads de outros gestores | RLS antigo permitia gestor ver todos | Migration 040: policy `gestor_veem_equipe_leads` filtra por `gestor_id` |

---

## 9. Próximos Passos Pendentes

### Fase 2: Transbordo Automático (INATIVIDADE)
- Após 15 minutos sem resposta do vendedor, atendimento volta para fila geral
- Campo `data_ultima_resposta_vendedor` na tabela `atendimentos`
- Cron job ou função Supabase para verificar inatividade

### Fase 3: Rodízio Automático
- Clientes não identificados (sem match no banco) vão para rodízio entre vendedores online
- Tabela/configuração de rodízio

### Fase 4: Integração WhatsApp Real
- Substituir simulação por webhook real (WABA, Evolution API, BotConversa, etc.)
- Estudo de custos: API oficial Meta cobra por conversa (R$0,045 utilidade / R$0,35 marketing)

### Segurança — Fase 3 (Hardening) Pendente
- Habilitar RLS em **todas** as tabelas (atualmente só em 4 tabelas)
- Padronizar autenticação para cookie-based em todas as APIs
- Adicionar Zod validation em todos os endpoints
- Atualizar Next.js 14.2.28 → 14.2.29+ ou 15.x (CVE conhecida)

### Outras melhorias
- Realtime no `ListaAtendimentos` (atualmente recarrega no refresh manual)
- Cache de filtros de produtos no localStorage
- Otimizar queries do dashboard (views materializadas)

---

## 10. Convenções de Código

### 9.1 Padrões
- TypeScript em todos os arquivos
- Componentes React: `PascalCase.tsx`
- APIs: `route.ts` (Next.js App Router convention)
- Hooks custom: `use[Nome].ts`
- Variáveis: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`

### 9.2 Supabase
- **Client-side:** `createClient()` do `@/lib/supabase/client` (respeita RLS)
- **Server-side API:** `createClient()` do `@/lib/supabase/server` (respeita RLS)
- **Service Role:** `createServiceClient(url, key)` do `@supabase/supabase-js` (bypass RLS)
- **Quando usar service_role:** APIs que precisam acessar dados de outros usuários (lista de vendedores, transferência, etc.)

### 9.3 Autenticação nas APIs
- Todas as APIs validam token JWT: `Authorization: Bearer <token>`
- Token obtido via `supabase.auth.getSession()` ou `supabase.auth.getUser(token)`

### 9.4 Deploy
- **Comando:** `cd crm-roma && npx vercel --prod --force`
- **Importante:** Sempre usar `--force` para evitar cache antigo
- **Windows PowerShell:** usar `cmd /c "cd crm-roma && npx vercel --prod --force"`

---

## 11. Contexto Importante para Próximo Agente

### 10.1 Ambiente
- **Supabase project:** `otmkukicneotcpkemvcq`
- **RLS está ATIVO** em 4 tabelas. Outras tabelas ainda precisam de RLS — ver seção 6.4
- **Service Role Key** está em `.env` (nunca commitar)
- **Windows CLI:** PowerShell pode bloquear `&&`, usar `cmd /c`
- **Security headers ativos:** X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Rate limiting ativo:** 5/min (cadastro), 30/min (prospecção), 20/min (atendimentos), 60/min (webhooks)

### 10.2 Millennium ERP
- URL: `roma.millenniumhosting.com.br:6017/api/millenium_eco/`
- Auth: NTLM (rede interna apenas)
- Integração via webhook quando disponível

### 10.3 Dados de Teste
- **Vendedores cadastrados:** Raquel, Brenda, Christyan, Gabriel, Jackson, João Pedro, Keila, Murilo, djfhsujdhfjsdhf (teste)
- **Cargos:** mistura de vendedor, gerente_comercial, diretor, admin
- **Clientes:** ~61 clientes no banco
- **Produtos:** 2195 produtos

### 10.4 Prospecção Inteligente (Configuração)
- Requer configuração de fonte de dados no `.env`:
  - `PROSPECCAO_FONTE=cnpjota` ou `cnpjaberto`
  - `CNPJOTA_TOKEN=seu_token` (obter em cnpjota.com.br)
  - `CNPJ_ABERTO_API_KEY=sua_key` (obter em cnpjaberto.com.br)
- CNPJota: 10 créditos grátis no cadastro + preview ilimitado. Depois R$0,10/empresa.
- CNPJ Aberto: 1.000 requisições/dia gratuitas.
- Dados são públicos da Receita Federal — totalmente legal para B2B.

### 10.5 Decisões Arquiteturais
- Atendimentos WhatsApp **NÃO** criam mais tarefas no kanban automaticamente
- Kanban "A Fazer" é reservado para tarefas manuais futuras
- Transferência manual funciona (botão no chat)
- Notificações combinam polling (60s) + realtime Supabase
- **Autorização por cargo:** APIs verificam `cargo` do usuário (diretor/admin/gerente_comercial = gestor)
- **Ownership checks:** PATCH/DELETE em tarefas, oportunidades, atendimentos, leads verifica se o recurso pertence ao usuário (exceto gestores)
- **Service role:** Usado apenas em operações que precisam bypassar RLS (criar usuário, listar vendedores, transferir atendimento)
- **Webhook Millennium:** Secret obrigatória. Se `MILLENNIUM_WEBHOOK_SECRET` não estiver configurado, retorna 500.

---

## 12. Como Continuar

Para implementar novas funcionalidades:

1. **Verificar migration necessária:** Adicionar colunas/tabelas em `supabase/migrations/`
2. **Criar/atualizar API:** Adicionar endpoint em `app/api/`
3. **Criar/atualizar componente:** Adicionar em `components/features/`
4. **Atualizar página:** Modificar `page.tsx` correspondente
5. **Testar local:** `npm run dev`
6. **Deploy:** `cmd /c "cd crm-roma && npx vercel --prod --force"`

**Sempre verifique o console do navegador (F12) para erros de API.**
