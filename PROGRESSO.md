# 📋 PROGRESSO - STK CRM

> Última atualização: 30/08/2026
> Repositório: github.com/Johnpittz/stk-crm
> Deploy: stk-crm-amber.vercel.app
> Stack: Next.js 14 + Supabase + Vercel (free tier)

---

## 🏗️ Visão Geral do Sistema

O STK CRM é um sistema de gestão de relacionamento com cliente composto por **3 perfis**:

| Perfil | Descrição | Rotas |
|--------|-----------|-------|
| **CRM** | Atendimento, Kanban, Dashboard, Clientes | `/`, `/kanban`, `/dashboard`, `/clientes` |
| **Marketing** | Campanhas, Disparos, Leads, Relatórios, Promoções | `/marketing/*` |
| **Pós-Vendas** | Follow-up, Satisfação, Suporte, Acompanhamento | `/pos-vendas/*` |

- **Admin** visualiza todos os 3 perfis
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

### Fase 6 - Arquitetura de Campanhas (ATUAL)
- [x] Campanhas como hub principal (removido Disparo separado)
- [x] Disparos vinculados a Campanhas (FK `campanha_id`)
- [x] Promoções vinculadas a Disparos (FK `promocao_id`)
- [x] Aba "Avulso" - múltiplos números (textarea)
- [x] Aba "Em Massa" - upload de planilha (Excel/CSV)
- [x] Extração automática de Nome + Telefone da planilha
- [x] Variáveis na mensagem: `{{nome}}`, `{{promocao}}`
- [x] Detecção automática de header em planilhas com linhas de título
- [x] Pré-visualização dos contatos importados

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

### Relacionamentos
```
campanhas ──1:N──> bulk_campaigns (campanha_id)
promocoes_marketing ──1:N──> bulk_campaigns (promocao_id)
campanhas ──1:N──> leads_marketing (origem_campanha_id)
bulk_campaigns ──1:N──> leads_marketing (origem_disparo_id)
```

---

## 🔧 Infraestrutura

### VPS (Hostinger KVM)
- **IP:** 2.25.192.248
- **Serviços:** PostgreSQL 18 + Evolution API (Docker container `john_hermes`)
- **Gerenciamento:** Supervisor + Docker `network_mode: host`

### Evolution API
- **STK:** 556299190117 (webhook MESSAGES_UPSERT configurado)
- **minha-conexao:** 5562982735286 (webhook MESSAGES_UPSERT configurado)
- **Porta:** 8082

### Frontend (Vercel)
- **URL:** stk-crm-amber.vercel.app
- **Tier:** Free (com cold start)
- **Deploy:** Via Vercel CLI com `--token`

### Supabase
- **Projeto:** otmkukicneotcpkemvcq
- **Tier:** Free

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

---

## 📁 Estrutura de Arquivos Importantes

```
stk-crm/
├── app/
│   ├── (dashboard)/
│   │   ├── marketing/
│   │   │   ├── campanhas/page.tsx    ← Hub principal (campanhas + disparos)
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
│   │   ├── atendimento/page.tsx
│   │   ├── kanban/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── clientes/page.tsx
│   └── api/
│       ├── bulk/send/route.ts        ← Envio de disparos
│       ├── instances/route.ts        ← Lista instâncias Evolution
│       ├── marketing/campanhas/route.ts
│       ├── marketing/leads/route.ts
│       └── marketing/promocoes/route.ts
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx               ← Sidebar dinâmica por perfil
│   │   └── perfil-selector.tsx       ← Seletor de perfil no header
│   └── ui/                           ← Componentes shadcn/ui
├── lib/
│   ├── perfil-ativo-context.tsx      ← Context do perfil ativo
│   ├── supabase/client.ts            ← Cliente browser Supabase
│   └── hooks/use-api.ts             ← Hook genérico useApi
├── supabase/migrations/
│   └── 071_marketing_posvendas_tables.sql
└── middleware.ts                      ← Auth + timeout 3s
```

---

## 🔜 Próximos Passos (Prioridade)

1. **Pós-Vendas** → Conectar follow-ups automáticos (quando cliente compra, cria follow-up)
2. **Marketing** → Conectar leads ao CRM (lead qualificado vira cliente)
3. **Relatórios** → Dashboard de métricas por perfil
4. **Permissões** → Controle de acesso por perfil (admin, vendedor, atendente)
5. **Chamadas** → Integrar VOIP para atender/ligar pelo CRM (ver pesquisa Twilio abaixo)

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

**Conclusão:** A Evolution API (via Baileys) consegue **receber e rejeitar** chamadas, mas **não consegue iniciar** nem **transmitir áudio** em tempo real. Para isso seria necessário um serviço VOIP externo como Twilio.

### Alternativa: Twilio
- **Preço:** ~$1/minuto para ligações
- **Setup:** Requer número Twilio + webhook para receber ligações
- **Integração:** Via API REST do Twilio
- **Custo mensal estimado:** $20-50 (dependendo do volume)

---

## 🔑 Credenciais (Referência)

| Serviço | Local | Notas |
|---------|-------|-------|
| Vercel | `VERCEL_TOKEN` env var | Deploy automático |
| Supabase | Dashboard web | Projeto `otmkukicneotcpkemvcq` |
| Evolution API | VPS:8082 | API Key no `.env` |
| GitHub | Token configurado | Repo `Johnpittz/stk-crm` |

---

*Este arquivo é atualizado automaticamente a cada fase concluída.*
