# 📋 PROGRESSO - STK CRM

> Última atualização: 10/06/2026
> Repositório: github.com/Johnpittz/stk-crm
> Deploy: stk-crm-amber.vercel.app
> Stack: Next.js 14 + Supabase + Vercel (free tier)

---

## 🏗️ Visão Geral do Sistema

O STK CRM é um sistema de gestão de relacionamento com cliente composto por **4 perfis**:

| Perfil | Descrição | Rotas |
|--------|-----------|-------|
| **CRM** | Atendimento, Kanban, Dashboard, Clientes | `/`, `/kanban`, `/dashboard`, `/clientes` |
| **Marketing** | Chatbot, Campanhas, Disparos, Leads, Relatórios, Promoções | `/chatbot`, `/marketing/*` |
| **Pós-Vendas** | Follow-up, Satisfação, Suporte, Acompanhamento | `/pos-vendas/*` |
| **Admin** | Visão completa + RECIEE (análise energética) | Todos + `/reciee` |

- **Admin** visualiza todos os perfis + módulo RECIEE
- **Configurações** e **Ajuda** ficam em comum em todos os perfis
- Sidebar dinâmica baseada no campo `perfil_principal` na tabela `profiles`

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
- [x] Tabela `bulk_campaigns` — insert alinhado com schema real (`name`, `message`, `numbers`)
- [x] Interface `Disparo` atualizada para colunas reais da tabela
- [x] Instância do WhatsApp salva no array `numbers` (formato: `["INSTANCIA", "numero1", "numero2"]`)
- [x] Bulk send extrai instância do array antes de enviar
- [x] Status do disparo traduzido para português (completed→Concluído, running→Enviando, failed→Falhou)
- [x] Auto-refresh a cada 5s quando disparo está "Enviando"
- [x] Tabelas `bulk_campanhas_contatos` — SQL pronto (enviado via .txt para executar no Supabase)

---

## 🗄️ Estrutura do Banco (Supabase)

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários do sistema (com `perfil_principal`) |
| `atendimentos` | Conversas WhatsApp |
| `atendimento_mensagens` | Mensagens das conversas |
| `tarefas` | Tarefas do Kanban |
| `notificacoes` | Notificações do sistema |

### Tabelas Marketing + Pós-Vendas
| Tabela | Descrição |
|--------|-----------|
| `campanhas` | Campanhas de marketing (hub) |
| `bulk_campaigns` | Disparos vinculados a campanhas |
| `leads_marketing` | Leads de marketing |
| `promocoes_marketing` | Cupons e promoções |
| `chamados_suporte` | Chamados de suporte |
| `pedidos_acompanhamento` | Acompanhamento de pedidos |
| `followups` | Follow-ups pós-venda |
| `avaliacoes_satisfacao` | Pesquisas de satisfação/NPS |

### Tabelas Chatbot
| Tabela | Descrição |
|--------|-----------|
| `chatbot_flows` | Fluxos de conversação (nome, instance, mensagem_inicial, horário comercial) |
| `chatbot_flow_steps` | Etapas dos fluxos (pergunta, opcoes, redirecionamento, scoring) |
| `chatbot_sessions` | Sessões por telefone (step atual, respostas, classificação A/B/C/D) |
| `chatbot_messages` | Histórico de mensagens (bot/cliente/ia) |

### Tabelas RECIEE
| Tabela | Descrição |
|--------|-----------|
| `clientes_reciee` | Clientes RECIEE (nome, CPF/CNPJ, UC, estado, distribuidora, grupo A/B) |
| `faturas_reciee` | Faturas de energia (competência, consumo, tarifa, ICMS, PIS, COFINS, bandeira, CIP) |
| `analises_reciee` | Análises de cobranças indevidas (severidade, código, descrição, valor estimado) |

### Relacionamentos
```
campanhas ──1:N──> bulk_campaigns (campanha_id)
promocoes_marketing ──1:N──> bulk_campaigns (promocao_id)
campanhas ──1:N──> leads_marketing (origem_campanha_id)
bulk_campaigns ──1:N──> leads_marketing (origem_disparo_id)
chatbot_flows ──1:N──> chatbot_flow_steps (flow_id)
chatbot_flows ──1:N──> chatbot_sessions (flow_id)
chatbot_sessions ──1:N──> chatbot_messages (session_id)
clientes_reciee ──1:N──> faturas_reciee (cliente_id)
faturas_reciee ──1:N──> analises_reciee (fatura_id)
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
13. **mensagem_final** → Encerramento ou encaminhamento

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

---

## 📱 Integração WhatsApp (Evolution API)

### Configuração Atual
| Instância | Número | Webhook | Status |
|-----------|--------|---------|--------|
| **STK** | 556299190117 | MESSAGES_UPSERT ✓ | Conectada |
| **ROMA_1** | 556282735286 (5286) | MESSAGES_UPSERT ✓ | Conectada |

### Fluxo de Mensagens
```
WhatsApp → Evolution API (webhook) → /api/webhooks/whatsapp
  → Rate limit (60/min)
  → Parse do payload (text, image, audio, video, document, sticker)
  → Upload mídia para Supabase Storage
  → Salvar mensagem no banco
  → [Chatbot ativo?] → Chatbot Engine
  → [IA ativa?] → Gemini AI Assistant
  → Resposta via Evolution API
```

### Funcionalidades
- Recebimento de mensagens (texto, mídia, áudio, documentos)
- Envio de mensagens de texto e mídia
- Deduplicação via `whatsapp_message_id`
- Filtro de mensagens de grupo (`@g.us`)
- Suporte a LID mode (remoteJidAlt para números reais)
- Sincronização batch de mensagens (`/api/atendimentos/sync-from-evolution`)
- Disparo em massa com cadência (3-8s entre envios, limite 60/hora)

---

## 🔗 Integrações Externas

| Integração | Uso | Endpoint |
|------------|-----|----------|
| **Evolution API** | WhatsApp messaging | `http://2.25.192.248:8082` |
| **Gemini 2.5 Flash** | AI responses + chatbot | `generativelanguage.googleapis.com` |
| **Millennium** | ERP (clientes, vendas) | Webhook `/api/webhooks/millennium` |
| **CNPJ Aberto** | Prospecção (dados de CNPJ) | API externa |
| **IBGE** | Dados geográficos | API externa |

---

## 🔧 Infraestrutura

### VPS (Hostinger KVM)
- **IP:** 2.25.192.248
- **Serviços:** PostgreSQL 18 + Evolution API (Docker container `john_hermes`)
- **Gerenciamento:** Supervisor + Docker `network_mode: host`

### Evolution API
- **STK:** 556299190117 (webhook MESSAGES_UPSERT configurado)
- **ROMA_1:** 556282735286 (webhook MESSAGES_UPSERT configurado)
- **Porta:** 8082

### Frontend (Vercel)
- **URL:** stk-crm-amber.vercel.app
- **Tier:** Free (com cold start)
- **Deploy:** Via Vercel CLI com `--token`

### Supabase
- **Projeto:** nizreygwaqqojwrorpqo
- **Tier:** Free

### Code Server
- **URL:** Via Cloudflare tunnel (porta 8443)
- **Último tunnel:** children-prep-textbooks-listing.trycloudflare.com

---

## ⚡ Otimizações Implementadas

| Otimização | Resultado |
|------------|-----------|
| Sync-from-evolution com batch queries | 300s → 743ms (400x) |
| Endpoint unificado `/api/atendimentos/page-data` | 6-8 chamadas → 1 |
| Polling da lista de conversas | 30s → 10s |
| Middleware timeout no `supabase.auth.getUser()` | Evita 504 |
| Índices no Supabase | `idx_atendimento_mensagens_wa_msg_id`, etc. |

---

## 🐛 Bugs Corrigidos

- **MIDDLEWARE_INVOCATION_TIMEOUT (504):** Timeout de 3s no `supabase.auth.getUser()`
- **Indicador de mensagem nova não aparecia:** Polling reduzido de 30s para 10s
- **Tema escuro com fundo branco nos cards:** Variáveis CSS atualizadas
- **Build quebrou por sed:** Faltava `}` na sintaxe
- **SelectItem value vazio:** shadcn não aceita `value=""` - removido item "Nenhuma"
- **LoadInstances retornando vazio:** API retorna `instancias` não `instances`
- **Planilha não reconhecia contatos:** Detecção automática de header com linhas de título
- **bulk_campaigns tabela incompatível:** ✅ Corrigido — insert alinhado com schema real, interface atualizada, instância salva no array numbers.

---

## 📁 Estrutura de Arquivos Importante

```
stk-crm/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── solicitar-acesso/page.tsx
│   ├── (dashboard)/
│   │   ├── atendimento/page.tsx        ← WhatsApp tickets
│   │   ├── chatbot/page.tsx            ← Dashboard chatbot (fluxos + sessões)
│   │   ├── kanban/page.tsx             ← Kanban de tarefas
│   │   ├── dashboard/page.tsx          ← Dashboard geral
│   │   ├── clientes/page.tsx           ← Gestão de clientes
│   │   ├── reciee/                     ← Módulo RECIEE
│   │   │   ├── page.tsx                ← Lista de clientes
│   │   │   ├── [clienteId]/page.tsx    ← Detalhe (faturas + análises)
│   │   │   └── upload/[clienteId]/page.tsx ← Upload de faturas PDF
│   │   ├── marketing/
│   │   │   ├── campanhas/page.tsx      ← Hub de campanhas + disparos
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
│       ├── reciee/                     ← APIs RECIEE
│       │   ├── clientes/route.ts       ← CRUD clientes
│       │   ├── clientes/[clienteId]/
│       │   │   ├── route.ts            ← PUT/DELETE cliente
│       │   │   ├── relatorio/route.ts  ← Gera Excel (.xlsx)
│       │   │   ├── proposta/route.ts   ← Gera proposta PDF
│       │   │   └── re-analisar/route.ts ← Re-análise
│       │   ├── analises/route.ts       ← CRUD análises
│       │   ├── faturas/route.ts        ← CRUD faturas
│       │   └── upload/[clienteId]/route.ts ← Upload + parse PDF
│       ├── chatbot/                    ← APIs Chatbot
│       │   ├── route.ts                ← Processa mensagens
│       │   ├── flows/route.ts          ← CRUD fluxos
│       │   └── sessions/route.ts       ← Gerencia sessões
│       ├── webhooks/
│       │   ├── whatsapp/route.ts       ← Webhook Evolution API (597 linhas)
│       │   └── millennium/route.ts     ← Webhook ERP
│       ├── bulk/
│       │   ├── campaigns/route.ts      ← CRUD campanhas bulk
│       │   └── send/route.ts           ← Envio de disparos
│       ├── atendimentos/
│       │   ├── route.ts                ← CRUD atendimentos
│       │   ├── mensagens/route.ts      ← Mensagens
│       │   ├── page-data/route.ts      ← Endpoint unificado
│       │   ├── sync/route.ts           ← Sync WhatsApp
│       │   └── sync-from-evolution/route.ts ← Batch sync
│       └── ... (outras 30+ rotas)
├── lib/
│   ├── chatbot/
│   │   └── engine.ts                   ← State machine do chatbot (675 linhas)
│   ├── ai-assistant.ts                 ← Gemini AI para respostas automáticas
│   ├── evolution-api.ts                ← Helper WhatsApp (enviar texto/mídia/áudio)
│   ├── integrations/
│   │   └── millennium-api.ts           ← Integração ERP
│   ├── supabase/
│   │   ├── client.ts                   ← Cliente browser
│   │   ├── server.ts                   ← Cliente server
│   │   ├── admin-server.ts             ← Service role (admin)
│   │   └── middleware.ts               ← Middleware auth
│   └── hooks/
│       └── use-api.ts                  ← Hook genérico
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                 ← Sidebar dinâmica por perfil
│   │   ├── header.tsx                  ← Header com seletor
│   │   └── perfil-selector.tsx
│   ├── features/
│   │   ├── atendimento/                ← 18 componentes (chat, kanban, painel)
│   │   ├── disparo/bulk-sender.tsx     ← Disparo em massa
│   │   ├── campanhas/                  ← Promoções
│   │   ├── clientes/                   ← Modal novo cliente
│   │   └── dashboard/                  ← Stats
│   └── ui/                             ← shadcn/ui (15 componentes)
├── supabase/migrations/
│   ├── 071_marketing_posvendas_tables.sql
│   ├── 072_chatbot_inteligente.sql     ← 4 tabelas chatbot
│   ├── 072_ligacao_modulos_marketing.sql
│   └── 073_reciee_tables.sql           ← 3 tabelas RECIEE
├── scripts/                            ← 56 scripts utilitários
└── public/templates/
    └── proposta_template.pdf           ← Template proposta RECIEE
```

---

## 📊 APIs Disponíveis (55 arquivos de rota, 93 handlers)

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
| Oportunidades | 1 | GET, POST, PATCH |
| Leads | 1 | GET, POST, PATCH |
| Prospecção | 1 | GET, POST |
| Produtos | 1 | GET |
| Promoções | 1 | GET, POST, PATCH |
| Clientes | 1 | POST |
| Auth | 1 | POST |
| WhatsApp/Instâncias | 2 | GET |
| Send (Envio) | 2 | POST |
| Notificações | 1 | GET, PATCH, DELETE |
| Mídia | 1 | GET |
| Config | 1 | GET, PUT |
| Debug | 3 | GET |
| Health | 1 | GET |
| Admin | 1 | GET, POST |

---

## 🔜 Próximos Passos (Prioridade)

1. **Criar tabela `bulk_campanhas_contatos`** no Supabase (SQL enviado via .txt)
2. **RECIEE** → Testar upload de faturas com o número 5286 (ROMA_1)
3. **Chatbot** → Conectar fluxo de qualificação ao pipeline de vendas
4. **Pós-Vendas** → Conectar follow-ups automáticos
5. **Marketing** → Conectar leads ao CRM (lead qualificado vira cliente)
6. **Relatórios** → Dashboard de métricas por perfil
7. **Permissões** → Controle de acesso por perfil (admin, vendedor, atendente)
8. **Chamadas** → Integrar VOIP para atender/ligar pelo CRM

---

## 📞 Pesquisa: Chamadas de Voz no CRM

### Evolution API + Baileys
| Funcionalidade | Suportado? |
|----------------|------------|
| Receber eventos de chamada | ✅ Sim (evento `call`) |
| Rejeitar chamada recebida | ✅ Sim (`rejectCall`) |
| Criar link de chamada | ✅ Sim (`createCallLink`) |
| Iniciar ligação direta | ❌ Não (restrição WhatsApp Web) |
| Falar pelo CRM | ❌ Não (sem suporte a WebRTC) |

**Conclusão:** A Evolution API consegue **receber e rejeitar** chamadas, mas **não consegue iniciar** nem **transmitir áudio** em tempo real. Para isso seria necessário Twilio (~$1/min).

---

## 🔑 Credenciais (Referência)

| Serviço | Local | Notas |
|---------|-------|-------|
| Vercel | `VERCEL_TOKEN` env var | Deploy automático |
| Supabase | Dashboard web | Projeto `nizreygwaqqojwrorpqo` |
| Evolution API | VPS:8082 | API Key no `.env` |
| GitHub | Token configurado | Repo `Johnpittz/stk-crm` |
| Gemini | API Key | AI para chatbot + auto-respostas |

---

*Este arquivo é atualizado automaticamente a cada fase concluída.*
