# 📋 PROGRESSO - STK CRM

> Última atualização: 12/09/2026
> Repositório: github.com/Johnpittz/stk-crm (público)
> Deploy: stk-crm-amber-delta.vercel.app
> Stack: Next.js 14 + Supabase + Vercel (free tier)

---

## 🏗️ Visão Geral do Sistema

O STK CRM é um sistema de gestão de relacionamento com cliente composto por **4 perfis**:

| Perfil | Descrição | Rotas |
|--------|-----------|-------|
| **CRM** | Atendimento, Kanban, Dashboard, Clientes | `/`, `/kanban`, `/dashboard`, `/clientes` |
| **Marketing** | Chatbot, Campanhas, Disparos, Leads, Relatórios, Promoções | `/chatbot`, `/marketing/*` |
| **Pós-Vendas** | Follow-up, Satisfação, Suporte, Acompanhamento | `/pos-vendas/*` |
| **Admin** | Visão completa + RECIEE (análise energética) + AXS | Todos + `/reciee` |

- **Admin** visualiza todos os perfis + módulo RECIEE + AXS Energia
- **Configurações** e **Ajuda** ficam em comum em todos os perfis
- Sidebar dinâmica baseada no campo `perfil_principal` na tabela `profiles`

---

## 📊 Visão Geral das Instâncias WhatsApp

| Instância | Número | Status | Webhook |
|-----------|--------|--------|---------|
| ROMA_2 | 556299190117 | ✅ Conectada | Vercel |
| STK-1 | 6295094949 | ✅ Conectada | Vercel |
| STK-2 | 62999961553 | ✅ Conectada | Vercel |

- Todas apontam para `https://stk-crm-amber-delta.vercel.app/api/webhooks/whatsapp`
- Evolution API key global: `66D55A2C-3356-4F4E-809C-9ACB9D237D50`

---

## 🤖 Infraestrutura VPS (2.25.192.248)

| Serviço | Porta | Gerenciamento | Descrição |
|---------|-------|---------------|-----------|
| Evolution API | 8080 | Docker | WhatsApp API |
| Webhook Proxy | 9998 | Supervisor | Proxy intermediário (não mais usado para webhooks) |
| Disparo Worker | (interno) | Supervisor | Worker Python de envio em massa |
| AXS API Server | 9999 | Supervisor | Servidor Playwright para automação AXS |
| code-server | 8443 | nginx proxy (8080/vscode/) | IDE remota |

---

## ✅ Funcionalidades Implementadas

### Fase 1 - Seletor de Perfil + Sidebar Dinâmica
- [x] Context do perfil ativo (`lib/perfil-ativo-context.tsx`)
- [x] Seletor de perfil no header (`components/layout/perfil-selector.tsx`)
- [x] Sidebar dinâmica por perfil (`components/layout/sidebar.tsx`)
- [x] Perfil salvo em localStorage

### Fase 2 - Rotas Básicas
- [x] 6 rotas Marketing: Dashboard, Campanhas, Leads, Relatórios, Promoções
- [x] 5 rotas Pós-Vendas: Dashboard, Follow-up, Satisfação, Suporte, Acompanhamento
- [x] Componente reutilizável para páginas em desenvolvimento

### Fase 3 - Páginas de Marketing
- [x] Dashboard com métricas reais do Supabase
- [x] Campanhas (hub principal - criar, expandir, gerenciar)
- [x] Leads (CRUD completo)
- [x] Relatórios com dados conectados
- [x] Promoções (CRUD completo)

### Fase 4 - Páginas de Pós-Vendas
- [x] Dashboard Pós-Vendas
- [x] Follow-up (CRUD)
- [x] Satisfação/NPS (CRUD)
- [x] Suporte/Chamados (CRUD)
- [x] Acompanhamento de entregas (CRUD)

### Fase 5 - Migration SQL + APIs
- [x] Migration `071_marketing_posvendas_tables.sql` criada
- [x] 7 tabelas criadas no Supabase
- [x] APIs CRUD para todas as páginas
- [x] Dados reais em Dashboard Marketing e Relatórios

### Fase 6 - Arquitetura de Campanhas
- [x] Campanhas como hub principal (removido Disparo separado)
- [x] Disparos vinculados a Campanhas (FK `campanha_id`)
- [x] Promoções vinculadas a Disparos (FK `promocao_id`)
- [x] Aba "Avulso" - múltiplos números (textarea)
- [x] Aba "Em Massa" - upload de planilha (Excel/CSV)
- [x] Extração automática de Nome + Telefone da planilha
- [x] Variáveis na mensagem: `{{nome}}`, `{{promocao}}`
- [x] Detecção automática de header em planilhas com linhas de título
- [x] Pré-visualização dos contatos importados

### Fase 7 - Chatbot Inteligente (WhatsApp)
- [x] Migration `072_chatbot_inteligente.sql` — 4 tabelas
- [x] Engine de state machine completo (`lib/chatbot/engine.ts` — 675 linhas)
- [x] Integração com Gemini 2.5 Flash para interpretação de respostas
- [x] Fluxo pré-configurado: "Sustentalski - Geração Distribuída" (14 etapas)
- [x] Classificação de leads por scoring (A≥80, B≥50, C≥25, D<25)
- [x] Horário comercial configurável por fluxo
- [x] Delay configurável entre mensagens
- [x] Branching condicional nas respostas
- [x] Redirect automático para vendedor quando chatbot não entende
- [x] Dashboard admin com 3 abas: Fluxos, Sessões, Stats
- [x] API CRUD para fluxos e sessões
- [x] Integração no webhook WhatsApp (`/api/webhooks/whatsapp`)
- [x] Fallback para AI Assistant quando chatbot não tratou
- [x] Criação automática de lead no CRM quando encaminha vendedor

### Fase 8 - AI Assistant (Gemini)
- [x] `lib/ai-assistant.ts` — respostas automáticas via Gemini 2.5 Flash
- [x] Toggle IA no atendimento (`/api/config/ia-toggle`)
- [x] System prompt profissional (pt-BR, tom amigável, 2-5 frases)
- [x] Histórico de conversas (últimas 10 mensagens como contexto)
- [x] Fallback graceful — nunca crasha o webhook

### Fase 9 - Módulo RECIEE (Recuperação de Cobranças Indevidas)
- [x] Migration `073_reciee_tables.sql` — 3 tabelas
- [x] Dashboard de clientes com stats (total, faturas, análises)
- [x] CRUD completo de clientes (nome, CPF/CNPJ, UC, estado, distribuidora, etc.)
- [x] Upload de faturas PDF com parsing automático (`pdf2json`)
- [x] Extração de dados: Group A (alta tensão/demanda) e Group B (consumidor)
- [x] Motor de verificação RECIEE: alíquota ICMS (GO 17%, MG 18%), PIS/COFINS
- [x] Classificação por severidade: crítico, alerta, ok, info
- [x] Detalhe do cliente com faturas + análises
- [x] Re-análise de faturas
- [x] Gerar relatório Excel (4 abas: Dados, Faturas, Análises, Resumo)
- [x] Gerar proposta comercial PDF (template com dados dinâmicos)
- [x] Sidebar-only para perfil Admin (seção ⚡ RECIEE)

### Fase 10 - Correções e Realinhamento
- [x] Chatbot movido do perfil CRM para Marketing na sidebar
- [x] Tabela `bulk_campaigns` — insert alinhado com schema real
- [x] Interface `Disparo` atualizada para colunas reais da tabela
- [x] Status do disparo traduzido para português
- [x] Auto-refresh a cada 5s quando disparo está "Enviando"

### Fase 11 - Chatbot: Correções e Gatilho (06/09/2026)
- [x] Bug fix: `.single()` → `.maybeSingle()`
- [x] Bug fix: chatbot não disparava em novos atendimentos
- [x] Bug fix: busca de fluxo sem filtro de instância
- [x] Campo `gatilho` no `chatbot_flows`: `'todos'` | `'disparo'`
- [x] Tabela `chatbot_gatilho_numeros`
- [x] Detecção de palavras de parada
- [x] Bloqueio de reativação: sessão concluída/encaminhada não reativa por 24h

### Fase 12 - Worker de Disparo + Múltiplas Instâncias (11/09/2026)
- [x] Worker Python (`/root/disparo_worker.py`) rodando via Supervisor
- [x] Polling a cada 5s no Supabase por campanhas `status=running`
- [x] Envio via Evolution API local (sem timeout do Vercel, sem cold start)
- [x] Processamento de fluxo de mensagens (texto + imagem, com delay configurável)
- [x] Substituição de variáveis: `{{nome}}`, `{{telefone}}`
- [x] Suporte a imagem via base64
- [x] Endpoint Vercel simplificado: apenas marca campanha como `running`
- [x] ROMA_2, STK-1, STK-2 todas conectadas
- [x] Campos de timing: `delay_inicial`, `intervalo`, `intervalo_passos`
- [x] Upload de imagem no disparo
- [x] Conta admin: `admstk@stk.com` / `stk123456`

### Fase 13 - Segurança + Webhook + LID Resolver (11/09/2026)
- [x] Validação `X-Webhook-Secret` em todas as requisições
- [x] Rate limiting: 180 req/min global, 660 req/min por endpoint
- [x] LID Resolver: `lib/lid-resolver.ts`
- [x] Tabela `lid_phone_map`
- [x] Repositório tornado público (Vercel Hobby)
- [x] Token Vercel salvo em `~/.vercel-token.env`

### Fase 14 - Mídia + Timestamp + Descriptografia (11/09/2026)
- [x] Endpoint `/api/media-download` — descriptografa áudio/imagem do WhatsApp
- [x] Player de áudio funcional no chat
- [x] Mensagens salvas com `messageTimestamp` do WhatsApp
- [x] Evolution API key atualizada para global (`66D55A2C-...`)

### Fase 15 - Integração AXS Energia (12/09/2026)
- [x] Migração `077_clientes_axs_columns.sql` — colunas AXS na tabela `clientes`
- [x] Migração `078_axs_propostas_table.sql` — tabela `axs_propostas`
- [x] Playwright automation (`/root/axs_api/axs_send.py` v15)
- [x] Servidor AXS na VPS (`/root/axs_api/server.py`, porta 9999)
- [x] Proxy nginx `/axs-api/` → porta 9999
- [x] Endpoint `/api/axs/send` no CRM → VPS AXS server
- [x] Página réplica do formulário AXS (`/clientes/[id]/axs-novo`)
- [x] Todos os 10 passos mapeados (PJ e PF)
- [x] Captura de erros via popups e keywords no body
- [x] Teste completo: proposta criada com UC `9.892.372.281.012-63`

### Fase 16 - Edição de Clientes (12/09/2026)
- [x] Botão "Editar" no detalhe do cliente
- [x] Página de edição (`/clientes/[id]/editar`)
- [x] GET/PUT/DELETE usando Supabase client direto (sem API route)
- [x] Campos: nome, telefone, email, CPF/CNPJ, cidade, estado, etc.

### Fase 17 - View Deduplicada (12/09/2026)
- [x] View `v_unified_clientes` reescrita com deduplicação por telefone
- [x] `bool_or()` para agregação de booleanos (não `MAX()`)
- [x] Colunas verificadas com information_schema
- [x] Prioridade: cadastro > RECIEE > chatbot > atendimento
- [x] Cada pessoa aparece uma única vez na listagem

---

## 🗄️ Estrutura do Banco (Supabase)

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários do sistema (com `perfil_principal`) |
| `clientes` | Clientes do CRM (~50 colunas incluindo AXS) |
| `atendimentos` | Conversas WhatsApp |
| `atendimento_mensagens` | Mensagens das conversas |
| `tarefas` | Tarefas do Kanban |
| `notificacoes` | Notificações do sistema |
| `lid_phone_map` | Mapeamento LID ↔ telefone |

### Tabelas Marketing + Pós-Vendas
| Tabela | Descrição |
|--------|-----------|
| `campanhas` | Campanhas de marketing (hub) |
| `bulk_campaigns` | Disparos vinculados a campanhas (com `fluxo_mensagens`, `intervalo_passos`, `delay_inicial`, `imagem_url`) |
| `leads_marketing` | Leads de marketing |
| `promocoes_marketing` | Cupons e promoções |
| `chamados_suporte` | Chamados de suporte |
| `pedidos_acompanhamento` | Acompanhamento de pedidos |
| `followups` | Follow-ups pós-venda |
| `avaliacoes_satisfacao` | Pesquisas de satisfação/NPS |
| `disparo_logs` | Logs de disparo em tempo real |

### Tabelas Chatbot
| Tabela | Descrição |
|--------|-----------|
| `chatbot_flows` | Fluxos de conversação (nome, instance, gatilho, mensagem_inicial) |
| `chatbot_flow_steps` | Etapas dos fluxos (pergunta, opcoes, redirecionamento, scoring) |
| `chatbot_sessions` | Sessões por telefone (step atual, respostas, classificação A/B/C/D) |
| `chatbot_messages` | Histórico de mensagens (bot/cliente/ia) |
| `chatbot_gatilho_numeros` | Números que receberam disparo (gatilho) |

### Tabelas RECIEE
| Tabela | Descrição |
|--------|-----------|
| `clientes_reciee` | Clientes RECIEE (nome, CPF/CNPJ, UC, estado, distribuidora, grupo A/B) |
| `faturas_reciee` | Faturas de energia (competência, consumo, tarifa, ICMS, PIS, COFINS, bandeira, CIP) |
| `analises_reciee` | Análises de cobranças indevidas (severidade, código, descrição, valor estimado) |

### Tabelas AXS
| Tabela | Descrição |
|--------|-----------|
| `axs_propostas` | Propostas AXS Energia sincronizadas |

### View
| View | Descrição |
|------|-----------|
| `v_unified_clientes` | View deduplicada por telefone (cadastro + RECIEE + chatbot + atendimentos) |

### Colunas da tabela `clientes` (verificadas via information_schema)
- `id`, `nome_razao_social`, `cnpj_cnpj`, `telefone`, `celular`, `email`, `endereco`, `cidade`, `estado`
- `vendedor_responsavel_id`, `grupo_economico_id`, `origem_lead`, `observacoes`
- `status`, `data_nascimento`, `whatsapp`, `razao_social`, `nome_fantasia`
- `rg_ie`, `inscricao_estadual`, `gender`
- `numero`, `complemento`, `bairro`, `cep`
- `vencimento_fatura`, `classe_tarifaria`, `subgrupo_tarifario`, `concessionaria`, `instalacao`, `bandeira`
- `iluminacao_publica`, `consorcio`, `usina`
- `consumo_jan` a `consumo_dez` (numeric)
- `geracao_propria`, `geracao_jan` a `geracao_dez` (numeric)
- `axs_card_id`, `axs_status`, `axs_mensalidade`, `axs_data_envio`

### Relacionamentos
```
campanhas ──1:N──> bulk_campaigns (campanha_id)
promocoes_marketing ──1:N──> bulk_campaigns (promocao_id)
campanhas ──1:N──> leads_marketing (origem_campanha_id)
bulk_campaigns ──1:N──> leads_marketing (origem_disparo_id)
chatbot_flows ──1:N──> chatbot_flow_steps (flow_id)
chatbot_flows ──1:N──> chatbot_sessions (flow_id)
chatbot_sessions ──1:N──> chatbot_messages (session_id)
chatbot_flows ──1:N──> chatbot_gatilho_numeros (flow_id)
clientes ──1:N──> faturas_reciee (cliente_id)
faturas_reciee ──1:N──> analises_reciee (fatura_id)
atendimentos ──1:N──> atendimento_mensagens (atendimento_id)
```

---

## 🤖 Chatbot Inteligente — Detalhes

### Arquitetura
```
Mensagem WhatsApp
       ↓
  Webhook (/api/webhooks/whatsapp)
       ↓
  [Sessão ativa?]
   ├── SIM → processarMensagemChatbot()
   │         ├── Interpretar resposta (Gemini ou match de opções)
   │         ├── Navegar para próximo step
   │         ├── Classificar lead (scoring)
   │         └── Responder via Evolution API
   │
   └── NÃO → [Fluxo existe para instância?]
              ├── SIM → Criar sessão + enviar mensagem inicial
              └── NÃO → [IA ativada?]
                         ├── SIM → gerarRespostaIA() (Gemini)
                         └── NÃO → Sem resposta
```

### Fluxo Pré-configurado: "Sustentalski - Geração Distribuída"
14 etapas de qualificação de leads para energia solar/GD:
1. **perfil** → Empresário, Doméstico, etc.
2. **objetivo** → Economia, Sustentabilidade, etc.
3. **valor_conta** → Valor da conta de luz
4. **localizacao** → Estado/cidade
5. **tipo_negocio** → Comércio, Indústria, Residencial
6. **situacao_atual** → Já tem GD, Não tem, Em processo
7. **decisao_compra** → Quem decide, Prazo
8. **momento_compra** → Aguardado, Urgente
9. **nome** → Nome do lead
10. **telefone** → Telefone
11. **email** → E-mail
12. **pergunta_ouro** → Pergunta aberta estratégica
13. **classificar** → Pontuação automática
14. **mensagem_final** → Encerramento ou encaminhamento

### Classificação de Leads (Scoring)
| Classificação | Pontos | Ação |
|---------------|--------|------|
| **A** (Quente) | ≥ 80 | Encaminha vendedor imediatamente |
| **B** (Qualificado) | ≥ 50 | Encaminha vendedor |
| **C** (Nutrição) | ≥ 25 | Mantém no fluxo |
| **D** (Frio) | < 25 | Encerramento educado |

### Dashboard Admin
- **Aba Fluxos**: Lista de fluxos, toggle ativo/inativo, contagem de sessões
- **Aba Sessões**: Lista com filtro por status, detalhe com histórico de mensagens
- **Aba Stats**: Métricas de performance do chatbot

### Sistema de Gatilho
- Campo `gatilho` no `chatbot_flows`: `'todos'` | `'disparo'`
  - **todos** → qualquer mensagem ativa o bot
  - **disparo** → só ativa se o número está em `chatbot_gatilho_numeros`
- Bulk send salva números na tabela ao enviar

### Parada do Chatbot
- **Por texto:** Palavras de parada: "parar", "cancelar", "sai", etc.
- **Por botão:** "Encerrar" no painel de contato
- **Bloqueio 24h:** Após encerrar, chatbot não reativa por 24h

---

## 📱 Integração WhatsApp (Evolution API)

### Configuração
- **API:** Evolution API (self-hosted na VPS, porta 8080)
- **Webhook:** MESSAGES_UPSERT → Vercel direto
- **Autenticação:** Header `apikey`
- **3 instâncias:** ROMA_2, STK-1, STK-2

### Fluxo de Mensagens
```
WhatsApp → Evolution API (webhook) → Vercel (/api/webhooks/whatsapp)
  → Validação X-Webhook-Secret
  → Rate limit (180/min)
  → LID Resolver (se necessário)
  → Parse do payload (text, image, audio, video, document, sticker)
  → Salvar mensagem no banco (com messageTimestamp)
  → [Chatbot ativo?] → Chatbot Engine
  → [IA ativa?] → Gemini AI Assistant
  → Resposta via Evolution API
```

### Funcionalidades
- Recebimento de mensagens (texto, mídia, áudio, documentos, stickers)
- Envio de mensagens de texto e mídia
- Deduplicação via `whatsapp_message_id`
- Filtro de mensagens de grupo (`@g.us`)
- Suporte a LID mode (remoteJidAlt para números reais)
- Descriptografia de mídia via `/api/media-download`
- Múltiplas instâncias WhatsApp (ROMA_2, STK-1, STK-2)
- Timestamp original do WhatsApp (`messageTimestamp`)
- Disparo em massa com cadência configurável

---

## 🔗 Integrações

| Integração | Uso | Status |
|------------|-----|--------|
| **Evolution API** | WhatsApp messaging (3 instâncias) | ✅ Ativa |
| **Gemini 2.5 Flash** | AI responses + chatbot | ✅ Ativa |
| **AXS Energia** | Criação de propostas via Playwright | ✅ Ativa |
| **Supabase** | Banco de dados + Storage + Auth | ✅ Ativa |
| **Millennium** | ERP (clientes, vendas) | ⚠️ Legado, não integrado |

---

## 🔧 Infraestrutura

### VPS (Hostinger KVM)
- **IP:** 2.25.192.248
- **Serviços:** Evolution API, Worker Disparo, AXS Server, Webhook Proxy
- **Portas:** 8080 (Evolution API), 8080/vscode/ (code-server), 9999 (AXS API)

### Frontend (Vercel)
- **URL:** stk-crm-amber-delta.vercel.app
- **Tier:** Free (com cold start)
- **Deploy:** Via Vercel CLI com `--token` (confirmação 1x por sessão, depois deploy livre)

### Supabase
- **Projeto:** nizreygwaqqojwrorpqo
- **Tier:** Free

---

## ⚡ Otimizações Implementadas

| Otimização | Resultado |
|------------|-----------|
| Endpoint unificado `/api/atendimentos/page-data` | 6-8 chamadas → 1 |
| Polling da lista de conversas | 30s → 10s |
| Worker de disparo na VPS | Sem timeout de 60s do Vercel |
| View deduplicada `v_unified_clientes` | Elimina duplicatas por telefone |
| Client edit com Supabase direto | Sem API route intermediária |

---

## 🐛 Bugs Corrigidos (Principais)

- **MIDDLEWARE_INVOCATION_TIMEOUT (504):** Timeout de 3s no `supabase.auth.getUser()`
- **Chatbot não disparava em novos atendimentos:** Adicionada verificação para atendimentos novos
- **`.single()` crashava o engine:** Trocado por `.maybeSingle()`
- **bulk_campaigns tabela incompatível:** Insert alinhado com schema real
- **Evolution API key mudou:** Atualizada para chave global `66D55A2C-...`
- **Webhooks apontavam para proxy:** Padronizados para Vercel direto
- **View mostrava duplicatas:** Reescrita com deduplicação por telefone
- **`MAX()` em booleanos:** Corrigido para `bool_or()`
- **Edit page 404:** Reescrita para usar Supabase client direto (sem API route)
- **Nome da tabela clientes:** `nome_razao_social` (não `nome_completo`)

---

## 📁 Estrutura de Arquivos Importante

```
stk-crm/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── solicitar-acesso/page.tsx
│   ├── (dashboard)/
│   │   ├── atendimento/page.tsx           ← WhatsApp tickets
│   │   ├── chatbot/page.tsx               ← Dashboard chatbot
│   │   ├── kanban/page.tsx                ← Kanban de tarefas
│   │   ├── dashboard/page.tsx             ← Dashboard geral
│   │   ├── clientes/
│   │   │   ├── page.tsx                   ← Lista de clientes
│   │   │   ├── novo/page.tsx              ← Novo cliente
│   │   │   └── [clienteId]/
│   │   │       ├── page.tsx               ← Detalhe do cliente
│   │   │       ├── editar/page.tsx        ← Editar cliente (Supabase direto)
│   │   │       ├── axs/page.tsx           ← AXS iframe + sidebar
│   │   │       └── axs-novo/page.tsx      ← AXS réplica do formulário
│   │   ├── reciee/
│   │   │   ├── page.tsx
│   │   │   ├── [clienteId]/page.tsx
│   │   │   └── upload/[clienteId]/page.tsx
│   │   ├── marketing/
│   │   │   ├── campanhas/page.tsx         ← Hub de campanhas + disparos + fluxo
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── relatorios/page.tsx
│   │   │   └── promocoes/page.tsx
│   │   ├── pos-vendas/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── follow-up/page.tsx
│   │   │   ├── satisfacao/page.tsx
│   │   │   ├── suporte/page.tsx
│   │   │   └── acompanhamento/page.tsx
│   │   └── configuracoes/
│   │       └── vendedores/page.tsx
│   └── api/
│       ├── webhooks/whatsapp/route.ts     ← Webhook Evolution API (seguro)
│       ├── bulk/
│       │   ├── campaigns/route.ts
│       │   └── send/route.ts              ← Marca como "running" (worker processa)
│       ├── upload-media/route.ts          ← Upload de imagem
│       ├── media-download/route.ts        ← Descriptografia de mídia WhatsApp
│       ├── axs/
│       │   ├── send/route.ts              ← Envia para VPS AXS server
│       │   ├── sync/route.ts
│       │   └── proposals/route.ts
│       ├── clientes/route.ts              ← GET/POST clientes
│       └── ...
├── lib/
│   ├── chatbot/engine.ts                  ← State machine (675 linhas)
│   ├── ai-assistant.ts                    ← Gemini AI
│   ├── evolution-api.ts                   ← Helper WhatsApp
│   ├── lid-resolver.ts                    ← LID → telefone
│   └── supabase/
│       ├── client.ts                      ← Browser client
│       ├── server.ts                      ← Server client
│       └── admin-server.ts                ← Service role
├── components/
│   ├── bulk-sender.tsx                    ← Disparo em massa
│   ├── dispatch-detail-dialog.tsx         ← Detalhe do disparo
│   ├── live-log-panel.tsx                 ← Logs em tempo real
│   └── ...
├── supabase/migrations/
│   ├── 071_marketing_posvendas_tables.sql
│   ├── 072_chatbot_inteligente.sql
│   ├── 073_reciee_tables.sql
│   ├── 074_chatbot_whitelist.sql
│   ├── 075_chatbot_numeros_whitelist.sql
│   ├── 076_lid_phone_map.sql
│   ├── 077_clientes_axs_columns.sql
│   ├── 078_axs_propostas_table.sql
│   ├── 079_add_fluxo_mensagens.sql
│   ├── 080_add_intervalo_passos.sql
│   ├── 081_add_delay_inicial.sql
│   ├── 082_drop_campanhas_status_check.sql
│   └── 083_deduplicate_clientes_view.sql
└── PROGRESSO.MD
```

---

## 📊 APIs Disponíveis

### Por Módulo
| Módulo | Rotas | Métodos |
|--------|-------|---------|
| RECIEE | 8 | GET, POST, PUT, DELETE |
| Chatbot | 3 | GET, POST, PUT, DELETE |
| Webhooks | 2 | POST |
| Atendimentos | 5 | GET, POST, PATCH |
| Bulk/Disparos | 2 | GET, POST, DELETE |
| Marketing | 3 | GET, POST |
| Pós-Vendas | 4 | GET, POST |
| Tarefas | 2 | GET, POST, PATCH, DELETE |
| Vendas/Vendedores | 2 | GET, POST |
| Clientes | 2 | GET, POST |
| AXS | 3 | GET, POST |
| Upload/Mídia | 2 | POST, GET |
| Auth | 1 | POST |
| Notificações | 1 | GET, PATCH, DELETE |
| Config | 1 | GET, PUT |
| Debug | 3 | GET |
| Health | 1 | GET |

---

## 🔑 Credenciais (Referência)

| Serviço | Local | Notas |
|---------|-------|-------|
| Vercel | `~/.vercel-token.env` | Deploy automático |
| Supabase | Dashboard web | Projeto `nizreygwaqqojwrorpqo` |
| Evolution API | VPS:8080 | Key global `66D55A2C-...` |
| GitHub | Repo público | `Johnpittz/stk-crm` |
| Gemini | API Key | AI para chatbot + auto-respostas |
| Admin CRM | `admstk@stk.com` / `stk123456` | Conta admin |
| AXS Energia | iris.axsenergia.com.br | Autenticação via login |

---

## 🔜 Próximos Passos (Prioridade)

1. **STK-3** → Conectar terceira instância quando número for fornecido
2. **WEBHOOK_SECRET** → Configurar variável de ambiente no Vercel Dashboard
3. **AXS Sync** → Puxar propostas do AXS API para o CRM (Fase 4)
4. **Pós-Vendas** → Conectar follow-ups automáticos
5. **Relatórios** → Dashboard de métricas por perfil
6. **Permissões** → Controle de acesso por perfil (admin, vendedor, atendente)

---

*Este arquivo é atualizado a cada fase concluída.*
