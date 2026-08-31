# 📋 PROGRESSO - STK CRM

> Última atualização: 30/08/2026

---

## 🎯 Visão Geral

O **STK CRM** é um sistema completo de gerenciamento de clientes, atendimento, marketing e pós-vendas, construído com Next.js, Supabase e Evolution API (WhatsApp).

- **Frontend:** Next.js 14 + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **WhatsApp:** Evolution API (Baileys)
- **Deploy:** Vercel (frontend) + Hostinger VPS (backend/WhatsApp)
- **URL:** https://stk-crm-amber.vercel.app

---

## 🏗️ Arquitetura de Perfis

O sistema possui **3 perfis** de usuário, cada um com sua sidebar e rotas próprias:

### 1. CRM (Atendimento)
| Rota | Descrição | Status |
|------|-----------|--------|
| `/atendimento` | Chat WhatsApp em tempo real | ✅ Funcional |
| `/kanban` | Tarefas e acompanhamento | ✅ Funcional |
| `/dashboard` | Visão gerencial | ✅ Funcional |
| `/clientes` | Gestão de clientes | ✅ Funcional |

### 2. Marketing
| Rota | Descrição | Status |
|------|-----------|--------|
| `/marketing/dashboard` | Métricas de marketing | ✅ Funcional |
| `/marketing/campanhas` | Campanhas + Disparos (hub) | ✅ Funcional |
| `/marketing/leads` | Prospecção de leads | ✅ Funcional |
| `/marketing/relatorios` | Análises e relatórios | ✅ Funcional |
| `/marketing/promocoes` | Ofertas e cupons | ✅ Funcional |

### 3. Pós-Vendas
| Rota | Descrição | Status |
|------|-----------|--------|
| `/pos-vendas/dashboard` | Visão pós-venda | ✅ Funcional |
| `/pos-vendas/follow-up` | Acompanhamento pós-venda | ✅ Funcional |
| `/pos-vendas/satisfacao` | Pesquisas e reviews | ✅ Funcional |
| `/pos-vendas/suporte` | Chamados e suporte | ✅ Funcional |
| `/pos-vendas/acompanhamento` | Entregas e logística | ✅ Funcional |

### Compartilhados
| Rota | Descrição | Status |
|------|-----------|--------|
| `/configuracoes` | Configurações do sistema | ✅ Funcional |
| `/ajuda` | Central de ajuda | ✅ Funcional |

---

## 📊 Fluxo de Marketing (Implementado)

```
┌─────────────────┐
│  CRIAR CAMPANHA │  ← Nome, descrição, tipo, datas, meta
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  NOVO DISPARO   │  ← Dentro da campanha
│  (Avulso/Massa) │
└────────┬────────┘
         │
         ├──→ AVULSO: Digita números manualmente
         │
         └──→ EM MASSA: Upload planilha (Excel/CSV)
                    │
                    ├── Sistema extrai automaticamente:
                    │   • Nome do Estabelecimento → {{nome}}
                    │   • WhatsApp/Telefone → destino
                    │
                    └── Mensagem-padrão com variáveis
                            │
                            ▼
                    ┌───────────────┐
                    │  ENVIO MASSA  │  ← Evolution API
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  ATENDIMENTO  │  ← Cliente responde
                    └───────────────┘
```

---

## 🔗 Ligação entre Módulos

### Tabelas Criadas (Migration 071)

| Tabela | Descrição |
|--------|-----------|
| `campanhas` | Campanhas de marketing |
| `leads_marketing` | Leads captados |
| `promocoes_marketing` | Cupons e promoções |
| `bulk_campaigns` | Disparos em massa (estendida) |
| `chamados_suporte` | Chamados de suporte |
| `pedidos_acompanhamento` | Pedidos em acompanhamento |
| `followups` | Follow-ups pós-venda |
| `avaliacoes_satisfacao` | Avaliações de satisfação |

### Colunas Adicionadas

**bulk_campaigns:**
- `campanha_id` → Vincula disparo à campanha
- `promocao_id` → Vincula promoção ao disparo
- `tipo_envio` → "avulso" ou "massa"
- `contatos` → JSON com lista de contatos (nome + telefone)
- `delay_min` / `delay_max` → Delay entre envios

**campanhas:**
- `meta` → Meta de mensagens

---

## 📁 Estrutura de Pastas

```
stk-crm/
├── app/
│   ├── (dashboard)/
│   │   ├── marketing/
│   │   │   ├── campanhas/page.tsx    ← Hub principal
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── promocoes/page.tsx
│   │   │   └── relatorios/page.tsx
│   │   ├── pos-vendas/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── follow-up/page.tsx
│   │   │   ├── satisfacao/page.tsx
│   │   │   ├── suporte/page.tsx
│   │   │   └── acompanhamento/page.tsx
│   │   ├── atendimento/page.tsx
│   │   ├── kanban/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── configuracoes/page.tsx
│   │   └── ajuda/page.tsx
│   ├── api/
│   │   ├── atendimentos/
│   │   ├── bulk/campaigns/
│   │   ├── instances/
│   │   └── marketing/
│   └── login/page.tsx
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx              ← Sidebar dinâmica por perfil
│   │   └── perfil-selector.tsx      ← Seletor de perfil
│   └── ui/                          ← shadcn/ui
├── lib/
│   ├── perfil-ativo-context.tsx     ← Context do perfil
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── hooks/use-api.ts
└── supabase/migrations/
    └── 071_marketing_posvendas_tables.sql
```

---

## 🔧 Infraestrutura

### VPS (Hostinger KVM)
- **IP:** 2.25.192.248
- **Container:** `john_hermes` (Docker, network_mode: host)
- **Serviços:** PostgreSQL 18 + Evolution API + Supervisor
- **Reinício:** `docker restart john_hermes`

### Evolution API
- **Porta:** 8082
- **Instâncias:**
  - `STK` (556299190117)
  - `minha-conexao` (5562982735286)
- **Webhooks:** MESSAGES_UPSERT configurados

### Supabase
- **Projeto:** `otmkukicneotcpkemvcq`
- **Tabelas principais:** atendimentos, atendimento_mensagens, profiles, campanhas, leads_marketing, promocoes_marketing, bulk_campaigns, chamados_suporte, followups, avaliacoes_satisfacao

### Variáveis de Ambiente (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`

---

## ⚡ Otimizações Implementadas

| Problema | Solução | Resultado |
|----------|---------|-----------|
| Sync lento (300s) | Batch queries no Supabase | 300s → 0.7s |
| Múltiplas chamadas API | Endpoint unificado `/api/atendimentos/page-data` | 6-8 → 1 chamada |
| Polling lento (30s) | Reduzido para 10s | Mensagens mais rápidas |
| Middleware timeout 504 | Timeout de 3s no `supabase.auth.getUser()` | Estabilidade |

---

## 🐛 Bugs Corrigidos

1. **Indicador de mensagem nova não aparecia** → Polling reduzido
2. **MIDDLEWARE_INVOCATION_TIMEOUT** → Timeout de 3s adicionado
3. **Tema escuro com fundo branco** → Variáveis CSS atualizadas
4. **Build quebrado (syntax)** → Corrigido
5. **SelectItem value vazio** → Removido
6. **Instâncias não apareciam** → Fix na chave da API (`instancias`)
7. **Planilha não reconhecia contatos** → Busca automática de header

---

## 📝 Variáveis Disponíveis (Disparos)

| Variável | Descrição | Fonte |
|----------|-----------|-------|
| `{{nome}}` | Nome do estabelecimento | Planilha |
| `{{promocao}}` | Cupom de desconto | Tabela promocoes |

---

## 🚀 Comandos Úteis

```bash
# Deploy no Vercel
cd /root/stk-crm && vercel --token "$VERCEL_TOKEN" --yes --prod

# Restart Evolution API
docker exec john_hermes supervisorctl restart evolution-api

# Push para GitHub
cd /root/stk-crm && git add -A && git commit -m "msg" && git push

# Verificar status das instâncias
curl -s http://localhost:8082/instance/fetchInstances | jq '.'
```

---

## 📌 Pendências / Próximos Passos

- [ ] Conectar dados mockados restantes em páginas
- [ ] Fase 6: Integração entre perfis (lead do Marketing → cliente no CRM)
- [ ] Fase 7: Permissões por perfil (admin, vendedor, atendente)
- [ ] Testar fluxo completo de envio via Evolution API
- [ ] Implementar relatórios com dados conectados

---

*Documento gerado automaticamente pelo Hermes Agent*
