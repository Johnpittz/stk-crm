# 📊 PROGRESSO - STK CRM

> Última atualização: 10/06/2026

---

## 🏗️ Visão Geral do Projeto

O **STK CRM** é um sistema de gestão de relacionamento com clientes construído com:
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS (tema escuro verde)
- **Backend:** Next.js API Routes + Supabase (PostgreSQL)
- **WhatsApp:** Evolution API (Baileys) rodando em Docker
- **Hospedagem:** Vercel (frontend) + Hostinger VPS (backend/WhatsApp)
- **Banco de Dados:** Supabase (PostgreSQL gerenciado)

---

## 👥 Perfis do Sistema

| Perfil | Descrição | Módulos |
|--------|-----------|---------|
| **Admin** | Visualiza tudo dos 3 perfis | Todos os módulos |
| **CRM** | Atendimento e gestão de clientes | Atendimento, Kanban, Dashboard, Clientes |
| **Marketing** | Campanhas e disparos em massa | Dashboard, Campanhas, Leads, Relatórios, Promoções |
| **Pós-Vendas** | Follow-up e suporte | Dashboard, Follow-up, Satisfação, Suporte, Acompanhamento |

---

## ✅ Funcionalidades Implementadas

### Fase 1 - Seletor de Perfil
- [x] Seletor de perfil no header
- [x] Sidebar dinâmica por perfil
- [x] Context de perfil ativo (localStorage)
- [x] Rotas prefixadas: `/`, `/marketing/`, `/pos-vendas/`

### Fase 2 - Rotas Básicas
- [x] 6 rotas de Marketing (Dashboard, Disparo, Campanhas, Leads, Relatórios, Promoções)
- [x] 5 rotas de Pós-Vendas (Dashboard, Follow-up, Satisfação, Suporte, Acompanhamento)

### Fase 3 - Páginas de Marketing
- [x] Dashboard com métricas reais
- [x] Campanhas (hub principal)
- [x] Leads com CRUD completo
- [x] Relatórios com dados conectados
- [x] Promoções com cupons

### Fase 4 - Páginas de Pós-Vendas
- [x] Dashboard com visão pós-venda
- [x] Follow-up de clientes
- [x] Pesquisas de satisfação (NPS)
- [x] Chamados de suporte
- [x] Acompanhamento de entregas

### Fase 5 - Banco de Dados
- [x] Migration SQL criada (`071_marketing_posvendas_tables.sql`)
- [x] 7 tabelas no Supabase:
  - `campanhas`
  - `leads_marketing`
  - `promocoes_marketing`
  - `chamados_suporte`
  - `pedidos_acompanhamento`
  - `followups`
  - `avaliacoes_satisfacao`

### Fase 6 - Integração entre Módulos
- [x] Campanha → Disparo (vinculação)
- [x] Disparo → Promoção (cupom automático)
- [x] Campanhas como hub (disparos dentro)
- [x] Remoção do módulo Disparo independente

### Fase 7 - Sistema de Disparos
- [x] **Avulso**: Campo para múltiplos números (textarea)
- [x] **Em Massa**: Upload de planilha (Excel/CSV)
- [x] Extração automática de nome + telefone da planilha
- [x] Detecção automática de header (pula linhas de título)
- [x] Mensagem-padrão com variáveis `{{nome}}` e `{{promocao}}`
- [x] Delay configurável entre envios

---

## 🔧 Correções e Otimizações

### Performance
- [x] Otimização do sync-from-evolution (300s → 700ms)
- [x] Polling de conversas: 30s → 10s
- [x] Endpoint unificado `/api/atendimentos/page-data`

### Bugs Corrigidos
- [x] MIDDLEWARE_INVOCATION_TIMEOUT (504) - timeout de 3s no auth
- [x] Indicador de mensagem nova não aparecia
- [x] SelectItem value vazio crashava dialog
- [x] Instâncias WhatsApp não carregavam no dropdown
- [x] Planilha não reconhecia contatos (header em linha de título)
- [x] Constraint CHECK na tabela campanhas

### Infraestrutura
- [x] Docker container `john_hermes` com `network_mode: host`
- [x] Supervisor com autorestart
- [x] Webhooks configurados (STK + minha-conexao)
- [x] Tema escuro verde aplicado globalmente

---

## 📁 Estrutura de Pastas

```
stk-crm/
├── app/
│   ├── (auth)/                    # Autenticação
│   │   ├── login/
│   │   └── solicitar-acesso/
│   ├── (dashboard)/               # Dashboard principal
│   │   ├── atendimento/           # Chat WhatsApp
│   │   ├── kanban/                # Tarefas
│   │   ├── dashboard/             # Métricas gerais
│   │   ├── clientes/              # Gestão de clientes
│   │   ├── marketing/
│   │   │   ├── dashboard/         # Métricas marketing
│   │   │   ├── campanhas/         # Hub principal
│   │   │   ├── leads/             # Prospecção
│   │   │   ├── relatorios/        # Análises
│   │   │   └── promocoes/         # Cupons
│   │   ├── pos-vendas/
│   │   │   ├── dashboard/         # Visão pós-venda
│   │   │   ├── follow-up/         # Acompanhamento
│   │   │   ├── satisfacao/        # NPS/Reviews
│   │   │   ├── suporte/           # Chamados
│   │   │   └── acompanhamento/    # Entregas
│   │   ├── configuracoes/         # Config do sistema
│   │   └── ajuda/                 # Central de ajuda
│   └── api/                       # Backend
│       ├── atendimentos/          # CRUD atendimentos
│       ├── bulk/                  # Disparos em massa
│       ├── instances/             # Instâncias WhatsApp
│       ├── marketing/             # APIs de marketing
│       └── pos-vendas/            # APIs de pós-vendas
├── components/
│   ├── layout/                    # Sidebar, Header, PerfilSelector
│   └── ui/                        # Componentes shadcn/ui
├── lib/
│   ├── supabase/                  # Cliente Supabase
│   ├── hooks/                     # Hooks customizados
│   └── perfil-ativo-context.tsx   # Context do perfil
└── supabase/
    └── migrations/                # Migrations SQL
```

---

## 🗄️ Tabelas do Banco de Dados

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `atendimentos` | Conversas WhatsApp |
| `atendimento_mensagens` | Mensagens das conversas |
| `profiles` | Perfis dos usuários |
| `tarefas` | Tarefas do Kanban |
| `notificacoes` | Notificações do sistema |

### Tabelas Marketing
| Tabela | Descrição |
|--------|-----------|
| `campanhas` | Campanhas de marketing |
| `leads_marketing` | Leads de prospecção |
| `promocoes_marketing` | Cupons e promoções |
| `bulk_campaigns` | Disparos em massa |

### Tabelas Pós-Vendas
| Tabela | Descrição |
|--------|-----------|
| `chamados_suporte` | Chamados de suporte |
| `pedidos_acompanhamento` | Acompanhamento de pedidos |
| `followups` | Follow-ups pós-venda |
| `avaliacoes_satisfacao` | Pesquisas de satisfação |

---

## 🔗 APIs Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/atendimentos/page-data` | GET | Dados da página de atendimento |
| `/api/bulk/campaigns` | GET/POST | Campanhas de disparo |
| `/api/bulk/send` | POST | Enviar disparo |
| `/api/instances` | GET | Listar instâncias WhatsApp |
| `/api/marketing/campanhas` | GET/POST | CRUD campanhas |
| `/api/marketing/leads` | GET/POST | CRUD leads |
| `/api/marketing/promocoes` | GET/POST | CRUD promoções |
| `/api/pos-vendas/chamados` | GET/POST | CRUD chamados |
| `/api/pos-vendas/followups` | GET/POST | CRUD follow-ups |
| `/api/pos-vendas/avaliacoes` | GET/POST | CRUD avaliações |

---

## 🚀 Deploy

| Serviço | URL | Observação |
|---------|-----|------------|
| Frontend | https://stk-crm-amber.vercel.app | Vercel (free tier) |
| Supabase | https://otmkukicneotcpkemvcq.supabase.co | Free tier |
| Evolution API | http://2.25.192.248:8082 | VPS Hostinger |
| VPS | 2.25.192.248 | Hostinger KVM |

---

## 📋 Fluxo de Marketing (Arquitetura Atual)

```
1. Criar Campanha (nome, tipo, datas, meta)
   ↓
2. Dentro da Campanha → Criar Disparo
   ↓
3. Escolher tipo:
   ├── Avulso → Colar números (1 por linha ou vírgula)
   └── Em Massa → Upload planilha (Excel/CSV)
   ↓
4. Configurar mensagem com variáveis:
   - {{nome}} → Nome do estabelecimento
   - {{promocao}} → Cupom de desconto
   ↓
5. Selecionar instância WhatsApp
   ↓
6. Enviar (com delay configurável)
   ↓
7. Mensagem chega no WhatsApp do cliente
   ↓
8. Cliente responde → Vai para Atendimento
   ↓
9. Vendedor qualifica → Lead → Cliente
```

---

## ⚠️ Limitações Conhecidas

### Chamadas de Voz
- **Receber eventos**: ✅ Sim (via webhook)
- **Rejeitar chamada**: ✅ Sim (`rejectCall`)
- **Criar link de chamada**: ✅ Sim (`createCallLink`)
- **Iniciar ligação direta**: ❌ Não suportado pelo Baileys
- **Atender e falar pelo CRM**: ❌ Não suportado (requer WebRTC)

### Infraestrutura
- Vercel free tier: cold start em funções serverless
- Supabase free tier: limites de conexão e存储
- Evolution API: sem suporte oficial a chamadas

---

## 🎯 Próximos Passos (Sugestões)

1. **Integração Marketing → CRM**: Lead do Marketing vira cliente no CRM
2. **Permissões por perfil**: Admin, vendedor, atendente
3. **Relatórios avançados**: Gráficos e exportação
4. **Notificações push**: Alertas em tempo real
5. **Integração com ERP**: Dados de vendas/estoque

---

## 📝 Notas Técnicas

### Variáveis de Ambiente Necessárias
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Comandos Úteis
```bash
# Deploy
vercel --token "$VERCEL_TOKEN" --yes --prod

# Verificar erros TypeScript
npx tsc --noEmit

# Push para GitHub
git add -A && git commit -m "msg" && git push
```

---

*Documento gerado automaticamente pelo Hermes Agent*
