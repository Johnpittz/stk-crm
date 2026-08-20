# CRM ROMA

Sistema de gestão comercial para vendedores físicos e diretoria.

## 🚀 Tecnologias

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts (gráficos)
- @hello-pangea/dnd (Kanban drag-and-drop)

## 📁 Estrutura

```
crm-roma/
├── app/
│   ├── (authenticated)/     # Rotas autenticadas
│   │   ├── atendimento/     # Tela do vendedor
│   │   ├── dashboard/       # Tela de gestão
│   │   └── layout.tsx       # Layout com sidebar
│   ├── login/               # Tela de login
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Componentes shadcn/ui
│   └── features/
│       └── atendimento/     # Componentes da tela de atendimento
├── lib/
│   ├── data/
│   │   └── mock.ts          # Dados mockados
│   └── utils/
│       └── cn.ts            # Utilitário de classes
└── ...
```

## 🛠️ Instalação

```bash
# Entrar na pasta do projeto
cd crm-roma

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## 📱 Telas

### Tela de Atendimento (Vendedor)
- `/atendimento` - Página principal do vendedor
- Performance em tempo real com projeção matemática
- Kanban de tarefas com drag-and-drop
- Agenda do dia
- Motor de oportunidades
- Toggle de presença (transbordo WhatsApp)
- Painel de incentivos

### Tela de Dashboard (Gestão)
- `/dashboard` - Visão gerencial
- Ranking de vendas
- Evolução mensal (12 meses)
- CAC por canal
- Churn analítico (com motivo obrigatório)
- Ticket médio protegido
- Mapa de calor

## 🗄️ Próximos Passos (Supabase)

1. Criar projeto no Supabase
2. Rodar o migration: `supabase/migrations/001_initial_schema.sql`
3. Configurar autenticação
4. Substituir dados mock pelas queries reais

## 📝 Notas

- Dados são mockados (fictícios) para demonstração
- Projeção matemática calcula tendência baseada em dias úteis
- Kanban permite arrastar tarefas entre colunas
- Toggle de presença simula transbordo de WhatsApp

