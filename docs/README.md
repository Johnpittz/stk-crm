# STK CRM — Documentação

> Sistema de Gestão Comercial com Integração WhatsApp
> Versão: Setembro 2026
> Repositório: github.com/Johnpittz/stk-crm

---

## Visão Geral

O STK CRM é um sistema de gestão de relacionamento com cliente composto por **4 perfis**:

- **CRM** — Atendimento, Kanban, Dashboard, Clientes
- **Marketing** — Chatbot, Campanhas, Disparos, Leads, Relatórios, Promoções
- **Pós-Vendas** — Follow-up, Satisfação, Suporte, Acompanhamento
- **Admin** — Visão completa + RECIEE (análise energética)

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes |
| Banco | Supabase (PostgreSQL) |
| WhatsApp | Evolution API (self-hosted) |
| AI | Gemini 2.5 Flash |
| Deploy | Vercel (frontend) + VPS Hostinger (Evolution API) |

## Estrutura de Arquivos

```
stk-crm/
├── app/(dashboard)/         ← Páginas do dashboard
│   ├── atendimento/         ← Chat WhatsApp
│   ├── kanban/              ← Kanban de tarefas + Oportunidades
│   │   └── kanban/              ← Funil de vendas (Oportunidades)
│   ├── clientes/            ← Gestão de clientes
│   ├── chatbot/             ← Dashboard chatbot
│   ├── marketing/           ← Campanhas, leads, relatórios
│   ├── pos-vendas/          ← Follow-up, suporte
│   └── reciee/              ← Análise de contas de luz
├── app/api/                 ← API Routes (30+ endpoints)
│   └── whatsapp/            ← Busca contatos, verificação números
├── components/
│   ├── features/atendimento/ ← 18+ componentes do chat
│   ├── layout/              ← Sidebar, header, seletor
│   └── ui/                  ← shadcn/ui
├── lib/
│   ├── chatbot/engine.ts    ← State machine (675 linhas)
│   ├── ai-assistant.ts      ← Gemini AI
│   └── evolution-api.ts     ← Helper WhatsApp
└── supabase/migrations/     ← SQL migrations
```

## Funcionalidades Principais

1. **Chat WhatsApp** — Receber/enviar mensagens, mídia, áudio, documentos
2. **Kanban de Vendas** — Funil visual de oportunidades
3. **Chatbot Inteligente** — Qualificação automática de leads
4. **AI Assistant** — Respostas automáticas via Gemini
5. **Múltiplas Instâncias** — Vários números WhatsApp simultâneos
6. **Disparo em Massa** — Envio de mensagens com cadência
7. **Pasta do Cliente** — Dados, GD, RECIEE, atendimentos, oportunidades
8. **RECIEE** — Análise de cobranças indevidas em contas de luz
9. **Busca de Contatos WhatsApp** — Modal de busca na agenda, verificação de números, criação direta de atendimento

## Convenções

- **Componentes**: arquivos `.tsx` em `components/features/`
- **APIs**: rotas em `app/api/` com autenticação via Supabase
- **Banco**: migrations numeradas em `supabase/migrations/`
- **Deploy**: git push → Vercel build automático
- **Estilo**: tema escuro (`#0a1628`), acentos azuis (`#3B64CF`)
