# 📁 Arquitetura do Projeto - CRM ROMA

## Estrutura de Pastas (Padrão Profissional)

```
crm-roma/
├── app/                           # App Router (Next.js 14)
│   ├── (auth)/                    # Grupo de rotas públicas
│   │   ├── login/
│   │   │   └── page.tsx           # Página de login
│   │   └── layout.tsx             # Layout sem sidebar
│   │
│   ├── (dashboard)/               # Grupo de rotas autenticadas
│   │   ├── layout.tsx             # Layout com sidebar
│   │   ├── page.tsx               # Redirect para atendimento
│   │   ├── atendimento/
│   │   │   └── page.tsx           # Tela do vendedor
│   │   ├── clientes/
│   │   │   └── page.tsx           # Gestão de clientes
│   │   ├── vendas/
│   │   │   └── page.tsx           # Histórico de vendas
│   │   ├── campanhas/
│   │   │   └── page.tsx           # Incentivos e metas
│   │   └── configuracoes/
│   │       └── page.tsx           # Preferências do sistema
│   │
│   ├── globals.css                # Estilos globais
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Redirect inicial
│
├── components/
│   ├── ui/                        # Componentes base (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   │
│   ├── layout/                    # Componentes de layout
│   │   ├── sidebar.tsx            # Navegação lateral
│   │   └── header.tsx             # Cabeçalho das páginas
│   │
│   └── features/                  # Componentes por funcionalidade
│       ├── atendimento/           # Componentes da tela de atendimento
│       │   ├── performance-realtime.tsx
│       │   ├── kanban-tarefas.tsx
│       │   ├── agenda-dia.tsx
│       │   ├── motor-oportunidades.tsx
│       │   ├── toggle-presenca.tsx
│       │   └── painel-incentivos.tsx
│       │
│       ├── clientes/              # (reservado)
│       ├── vendas/                # (reservado)
│       ├── campanhas/             # (reservado)
│       └── configuracoes/         # (reservado)
│
├── lib/                           # Utilitários e dados
│   ├── utils/
│   │   └── cn.ts                  # Helper de classes
│   └── data/
│       └── mock.ts                # Dados mockados
│
├── public/                        # Arquivos estáticos
├── next.config.js                 # Config do Next.js
├── tailwind.config.ts             # Config do Tailwind
├── tsconfig.json                  # Config do TypeScript
└── package.json                   # Dependências
```

## Convenções de Nomenclatura

### Arquivos
- **Páginas**: `page.tsx` (Next.js App Router)
- **Layouts**: `layout.tsx`
- **Componentes**: `kebab-case.tsx` (ex: `performance-realtime.tsx`)
- **Utilitários**: `camelCase.ts` (ex: `mock.ts`)

### Componentes React
- **PascalCase** para nomes de componentes
- **Interface/Type**: Mesmo nome do componente + `Props`

```tsx
// Exemplo
interface PerformanceRealTimeProps {
  vendedorId: string;
}

export function PerformanceRealTime({ vendedorId }: PerformanceRealTimeProps) {
  // ...
}
```

## Padrões de Código

### Imports
1. React/Next
2. Bibliotecas externas
3. Componentes UI (shadcn)
4. Componentes de features
5. Utilitários
6. Dados/Types

```tsx
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";

import { cn } from "@/lib/utils/cn";
import { vendedorAtual } from "@/lib/data/mock";
```

### Estrutura de Páginas

```tsx
"use client"; // Se necessário

import { ... } from "...";

/**
 * NomeDaPaginaPage
 * 
 * Descrição breve do que a página faz.
 */

export default function NomeDaPaginaPage() {
  // Hooks
  const [state, setState] = useState();
  
  // Funções
  const handleAction = () => { ... };
  
  // Render
  return (
    <div className="space-y-6">
      {/* Conteúdo */}
    </div>
  );
}
```

## Rotas Disponíveis

| Rota | Descrição | Grupo |
|------|-----------|-------|
| `/login` | Tela de autenticação | `(auth)` |
| `/atendimento` | Área de trabalho do vendedor | `(dashboard)` |
| `/clientes` | Gestão de clientes | `(dashboard)` |
| `/vendas` | Histórico de vendas | `(dashboard)` |
| `/campanhas` | Campanhas e incentivos | `(dashboard)` |
| `/configuracoes` | Preferências do sistema | `(dashboard)` |

## Próximos Passos (Integração Supabase)

1. Substituir `lib/data/mock.ts` por queries reais
2. Implementar autenticação no `(auth)`
3. Adicionar proteção de rotas no `(dashboard)`
4. Criar hooks customizados para cada feature
