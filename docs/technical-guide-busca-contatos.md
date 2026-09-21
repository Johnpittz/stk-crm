# 📋 Guia Técnico: Busca de Contatos WhatsApp via Evolution API

> **Status:** Produção (STK-CRM v1.7.0)  
> **Instância destino:** `ROMA_1`  
> **Autor:** Hermes Agent  
> **Data:** 20/09/2026

---

## Sumário

1. [Arquitetura](#1-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Variáveis de Ambiente](#3-variáveis-de-ambiente)
4. [Endpoints da Evolution API](#4-endpoints-da-evolution-api)
5. [Step-by-step: Criar as 5 peças](#5-step-by-step)
6. [Código completo de cada arquivo](#6-código-completo)
7. [Integração na página de atendimento](#7-integração)
8. [Cuidados e armadilhas](#8-cuidados)
9. [Teste e validação](#9-teste)

---

## 1. Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React)                  │
│                                                     │
│  ┌─────────────────────┐   ┌──────────────────────┐ │
│  │  Página Atendimento │──▶│ Modal BuscarContatos │ │
│  │  (page.tsx)         │   │ (214 linhas)         │ │
│  │                     │   │                      │ │
│  │  • Botão "Novo      │   │ • Input com debounce │ │
│  │    Contato"         │   │ • Lista de contatos  │ │
│  │  • handleContato-   │   │ • Verificação WA     │ │
│  │    Selecionado()    │   │ • Seleção → onClose  │ │
│  └─────────────────────┘   └──────────┬───────────┘ │
│                                       │              │
├───────────────────────────────────────┼──────────────┤
│                    API (Next.js)      │              │
│                                       ▼              │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │ /api/whatsapp/     │  │ /api/whatsapp/         │  │
│  │ contacts           │  │ check-number           │  │
│  │ GET  ?search&limit │  │ POST {numbers: [...]}  │  │
│  └─────────┬──────────┘  └──────────┬─────────────┘  │
│            │                        │                 │
├────────────┼────────────────────────┼─────────────────┤
│            ▼                        ▼                 │
│  ┌───────────────────────────────────────────────┐   │
│  │           lib/evolution-api.ts                │   │
│  │                                               │   │
│  │  findContacts()     → POST /chat/findContacts │   │
│  │  checkWhatsAppNumbers() → POST /chat/whatsapp │   │
│  │  formatarTelefone() → helper de formatação     │   │
│  └───────────────────┬───────────────────────────┘   │
│                      │                               │
├──────────────────────┼───────────────────────────────┤
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐   │
│  │        Evolution API (self-hosted)            │   │
│  │        http://2.25.192.248:8080               │   │
│  │        Instância: ROMA_1                      │   │
│  │        POST /chat/findContacts/ROMA_1         │   │
│  │        POST /chat/whatsappNumbers/ROMA_1      │   │
│  └───────────────────────────────────────────────┘   │
│                      │                               │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐   │
│  │              PostgreSQL (Evolution)           │   │
│  │              Tabela: Contact                  │   │
│  │              2.730 contatos (STK)             │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Fluxo de dados

1. Usuário clica em "Novo Contato"
2. Modal abre → `fetchContacts("")` carrega todos os contatos (limit=100)
3. Usuário digita → debounce 300ms → `fetchContacts(searchTerm)` filtra
4. Usuário clica em um contato → `onSelect(contact)` → fecha modal
5. `handleContatoSelecionado` cria atendimento via `POST /api/atendimentos`
6. Chat abre automaticamente com o contato selecionado

---

## 2. Pré-requisitos

### No projeto destino (CRM ROMA)

- [ ] Next.js 14+ com App Router
- [ ] shadcn/ui instalado (`Input`, `Button`, `Badge`)
- [ ] Lucide React instalado (`lucide-react`)
- [ ] Rota `POST /api/atendimentos` funcionando (ou adaptar para a entidade do projeto)
- [ ] Evolution API rodando com instância `ROMA_1` conectada

### Para verificar a instância

```bash
# Testar conexão com a instância
curl -s "http://2.25.192.248:8080/instance/connectionState/ROMA_1" \
  -H "apikey: SUA_API_KEY"

# Deve retornar: { "instance": { "instanceName": "ROMA_1", "state": "open" } }

# Testar busca de contatos
curl -s -X POST "http://2.25.192.248:8080/chat/findContacts/ROMA_1" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{"where":{},"limit":2}'

# Deve retornar array com 2 contatos
```

---

## 3. Variáveis de Ambiente

No **Vercel** (Settings → Environment Variables):

| Variável | Valor | Observação |
|----------|-------|-----------|
| `EVOLUTION_API_URL` | `http://2.25.192.248:8080` | URL pública do servidor |
| `EVOLUTION_API_KEY` | `sua-chave-aqui` | Chave de autenticação (64 chars) |
| `EVOLUTION_INSTANCE` | `ROMA_1` | ⚠️ Pode estar errado como no STK |

> ⚠️ **Armadilha conhecida:** O `EVOLUTION_INSTANCE` no Vercel pode estar com valor antigo (`minha-conexao`, `ROMA_2`, etc.). Por isso, o código faz **hardcode** da instância correta no `findContacts`.

---

## 4. Endpoints da Evolution API

### POST /chat/findContacts/{instance}

Lista contatos da agenda do WhatsApp (contatos salvos + contatos de grupos).

**Request:**
```json
POST http://2.25.192.248:8080/chat/findContacts/ROMA_1
Headers:
  Content-Type: application/json
  apikey: SUA_API_KEY

Body:
{
  "where": {},
  "limit": 100
}
```

**Response (200):**
```json
[
  {
    "id": "cmtw3h7h3028cmqyx8v4crxh2",
    "remoteJid": "556282735286@s.whatsapp.net",
    "pushName": "João Pedro",
    "profilePicUrl": null,
    "createdAt": "2026-09-10T22:24:17.176Z",
    "updatedAt": "2026-09-13T13:28:48.960Z",
    "instanceId": "ad7dd71b-8b7a-4cb2-890f-ca0b875080c7",
    "isGroup": false,
    "isSaved": true,
    "type": "contact"
  }
]
```

**Campos importantes:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `remoteJid` | string | ID do WhatsApp (`5562...@s.whatsapp.net` ou `...@lid`) |
| `pushName` | string\|null | Nome exibido no WhatsApp |
| `profilePicUrl` | string\|null | URL da foto de perfil |
| `isSaved` | boolean | Se está salvo na agenda |
| `isGroup` | boolean | Se é grupo |
| `type` | string | `"contact"` ou `"group"` |

---

### POST /chat/whatsappNumbers/{instance}

Verifica se números existem no WhatsApp.

**Request:**
```json
POST http://2.25.192.248:8080/chat/whatsappNumbers/ROMA_1
Headers:
  Content-Type: application/json
  apikey: SUA_API_KEY

Body:
{
  "numbers": ["5562999999999", "5562888888888"]
}
```

**Response (200):**
```json
[
  { "number": "5562999999999", "exists": true,  "jid": "5562999999999@s.whatsapp.net" },
  { "number": "5562888888888", "exists": false, "jid": null }
]
```

> **Nota:** Os números devem estar no formato completo com código do país (55).

---

## 5. Step-by-step

### Passo 1: Criar `lib/evolution-api.ts`

Se o projeto **já tem** esse arquivo (helper da Evolution API), **adicione** as duas funções:
- `findContacts()`
- `checkWhatsAppNumbers()`

Se o projeto **não tem**, crie o arquivo com as constantes + helper `formatarTelefone` + as duas funções.

**Atenção:** Na linha da instância padrão, use `ROMA_1`:
```ts
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'ROMA_1';
```

E na função `findContacts`, hardcoded:
```ts
const instanceName = instance || 'ROMA_1';
```

### Passo 2: Criar API routes

Crie 2 arquivos em `app/api/whatsapp/`:
- `contacts/route.ts` — GET (busca contatos)
- `check-number/route.ts` — POST (verifica números)

As rotas são **genéricas** — apenas passam o parâmetro `instance` para a lib. Não precisam de alteração.

### Passo 3: Criar componente modal

Crie `components/features/atendimento/buscar-contatos-whatsapp.tsx` com o código completo da seção [6.4](#64-buscar-contatoswhatsapp).

O componente é **genérico** — recebe `instance` como prop. Não precisa de alteração.

### Passo 4: Integrar na página de atendimento

Na página principal do módulo de atendimento:

1. **Importar** o componente
2. **Adicionar state** `buscarContatosAberto`
3. **Adicionar botão** "Novo Contato" na toolbar
4. **Renderizar** o modal
5. **Implementar** `handleContatoSelecionado`

### Passo 5: Variáveis de ambiente

Configure no Vercel:
- `EVOLUTION_API_URL` → `http://2.25.192.248:8080`
- `EVOLUTION_API_KEY` → chave da instância ROMA_1
- `EVOLUTION_INSTANCE` → `ROMA_1`

### Passo 6: Deploy e teste

```bash
git add -A
git commit -m "feat: busca de contatos WhatsApp via Evolution API"
git push origin main
```

---

## 6. Código Completo

### 6.1 — `lib/evolution-api.ts` (trecho relevante)

Adicione ao final do arquivo existente ou crie novo:

```ts
// ============================================================
// BUSCA DE CONTATOS E VERIFICAÇÃO DE NÚMEROS
// ============================================================

/**
 * Verifica se números existem no WhatsApp
 * POST /chat/whatsappNumbers/{instance}
 */
export async function checkWhatsAppNumbers(params: {
  numbers: string[];
  instance?: string;
}): Promise<{
  success: boolean;
  results: Array<{ number: string; exists: boolean; jid: string | null }>;
  error?: string;
}> {
  const { numbers, instance } = params;
  const instanceName = instance || 'ROMA_1';

  if (!EVOLUTION_API_KEY) {
    return { success: false, results: [], error: 'API Key não configurada' };
  }

  if (!numbers || numbers.length === 0) {
    return { success: false, results: [], error: 'Nenhum número informado' };
  }

  const numerosFormatados = numbers.map(n => formatarTelefone(n));

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ numbers: numerosFormatados }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Evolution API] Erro check numbers:', response.status, data);
      return { 
        success: false, 
        results: [], 
        error: data?.message || data?.error || `HTTP ${response.status}` 
      };
    }

    const results = Array.isArray(data) ? data.map((item: any) => ({
      number: item.number || '',
      exists: item.exists || false,
      jid: item.jid || null,
    })) : [];

    return { success: true, results };
  } catch (err: any) {
    console.error('[Evolution API] Erro check numbers:', err.message);
    return { success: false, results: [], error: err.message };
  }
}

/**
 * Lista contatos do WhatsApp (agenda + contatos de grupos)
 * POST /chat/findContacts/{instance}
 */
export async function findContacts(params: {
  search?: string;
  limit?: number;
  instance?: string;
}): Promise<{
  success: boolean;
  contacts: Array<{
    id: string;
    remoteJid: string;
    pushName: string | null;
    profilePicUrl: string | null;
    isSaved: boolean;
    isGroup: boolean;
    type: string;
  }>;
  total: number;
  error?: string;
}> {
  const { search, limit = 100, instance } = params;
  // HARDCODE: defina a instância correta do projeto
  const instanceName = instance || 'ROMA_1';

  if (!EVOLUTION_API_KEY) {
    return { success: false, contacts: [], total: 0, error: 'API Key não configurada' };
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findContacts/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ where: {}, limit }),
      }
    );

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      console.error('[Evolution API] Erro findContacts:', response.status, data);
      return { 
        success: false, 
        contacts: [], 
        total: 0,
        error: data?.message || data?.error || `HTTP ${response.status}` 
      };
    }

    let contacts = Array.isArray(data) ? data.map((item: any) => ({
      id: item.id || '',
      remoteJid: item.remoteJid || '',
      pushName: item.pushName || null,
      profilePicUrl: item.profilePicUrl || null,
      isSaved: item.isSaved || false,
      isGroup: item.isGroup || false,
      type: item.type || 'contact',
    })) : [];

    // Filtrar por busca (client-side)
    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter((c: any) => 
        c.pushName?.toLowerCase().includes(searchLower) ||
        c.remoteJid?.includes(search)
      );
    }

    return { success: true, contacts, total: contacts.length };
  } catch (err: any) {
    console.error('[Evolution API] Erro findContacts:', err.message);
    return { success: false, contacts: [], total: 0, error: err.message };
  }
}
```

### 6.2 — `app/api/whatsapp/contacts/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { findContacts } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const instance = searchParams.get("instance") || undefined;

    if (limit > 500) {
      return NextResponse.json(
        { error: "Máximo de 500 contatos por requisição" },
        { status: 400 }
      );
    }

    const result = await findContacts({ search, limit, instance });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      total: result.total,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao buscar contatos" },
      { status: 500 }
    );
  }
}
```

### 6.3 — `app/api/whatsapp/check-number/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { checkWhatsAppNumbers } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numbers, instance } = body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json(
        { error: "Campo 'numbers' é obrigatório e deve ser um array" },
        { status: 400 }
      );
    }

    if (numbers.length > 20) {
      return NextResponse.json(
        { error: "Máximo de 20 números por requisição" },
        { status: 400 }
      );
    }

    const result = await checkWhatsAppNumbers({ numbers, instance });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      results: result.results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao verificar números" },
      { status: 500 }
    );
  }
}
```

### 6.4 — `components/features/atendimento/buscar-contatos-whatsapp.tsx`

```tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, UserPlus, Phone, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppContact {
  id: string;
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
  isSaved: boolean;
  isGroup: boolean;
  type: string;
}

interface BuscarContatosWhatsAppProps {
  open: boolean;
  onClose: () => void;
  onSelect: (contact: WhatsAppContact) => void;
  instance?: string;
}

export function BuscarContatosWhatsApp({
  open,
  onClose,
  onSelect,
  instance,
}: BuscarContatosWhatsAppProps) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchContacts = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (instance) params.set("instance", instance);
      params.set("limit", "100");

      const response = await fetch(`/api/whatsapp/contacts?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao buscar contatos");
        setContacts([]);
      } else {
        setContacts(data.contacts || []);
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  // Debounce na busca
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchContacts(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchContacts]);

  // Buscar contatos ao abrir o modal
  useEffect(() => {
    if (open) {
      setSearch("");
      fetchContacts("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchContacts]);

  const extractPhone = (jid: string) => {
    return jid.replace("@s.whatsapp.net", "").replace("@lid", "");
  };

  const handleSelect = (contact: WhatsAppContact) => {
    onSelect(contact);
    onClose();
    setSearch("");
    setContacts([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1d32] border border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#3B64CF]" />
            <h3 className="text-sm font-medium text-white">
              Buscar Contatos WhatsApp
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="w-full h-9 text-sm pl-8 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B64CF]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          {loading && (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-[#3B64CF] animate-spin" />
            </div>
          )}

          {error && (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-white/40">
                {search
                  ? "Nenhum contato encontrado"
                  : "Digite para buscar contatos"}
              </p>
            </div>
          )}

          {!loading && !error && contacts.length > 0 && (
            <div className="space-y-0.5">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelect(contact)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left rounded-lg"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-[#3B64CF]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {contact.profilePicUrl ? (
                      <img
                        src={contact.profilePicUrl}
                        alt={contact.pushName || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserPlus className="h-4 w-4 text-[#3B64CF]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">
                        {contact.pushName || "Sem nome"}
                      </span>
                      {contact.isSaved && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-green-500/20 text-green-400 border-green-500/30"
                        >
                          Salvo
                        </Badge>
                      )}
                      {contact.isGroup && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30"
                        >
                          Grupo
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-white/40">
                      {extractPhone(contact.remoteJid)}
                    </span>
                  </div>

                  {/* Action */}
                  <MessageSquare className="h-4 w-4 text-white/30 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/10">
          <p className="text-xs text-white/30">
            {contacts.length} contato(s) encontrado(s)
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Integração na página de atendimento

### 7.1 — Imports

```tsx
import { BuscarContatosWhatsApp } from "@/components/features/atendimento/buscar-contatos-whatsapp";
import { UserPlus } from "lucide-react";
```

### 7.2 — State

```tsx
const [buscarContatosAberto, setBuscarContatosAberto] = useState(false);
```

### 7.3 — Botão na toolbar

Adicione na barra de ferramentas do chat, junto ao seletor de instância:

```tsx
<button
  onClick={() => setBuscarContatosAberto(true)}
  className="h-8 px-3 rounded-lg border bg-[#3B64CF]/20 border-[#3B64CF]/30 text-[#3B64CF] hover:bg-[#3B64CF]/30 transition-colors flex items-center gap-1.5 text-xs font-medium"
  title="Buscar contatos WhatsApp"
>
  <UserPlus className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Novo Contato</span>
</button>
```

### 7.4 — Renderizar o modal

```tsx
<BuscarContatosWhatsApp
  open={buscarContatosAberto}
  onClose={() => setBuscarContatosAberto(false)}
  onSelect={handleContatoSelecionado}
  instance={instanciaSelecionada !== "todas" ? instanciaSelecionada : undefined}
/>
```

### 7.5 — Handler de seleção

Quando o usuário seleciona um contato, cria um novo atendimento (conversa):

```tsx
const handleContatoSelecionado = useCallback(async (contact: WhatsAppContact) => {
  const telefone = contact.remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "");

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/atendimentos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        telefone_cliente: telefone,
        nome_cliente: contact.pushName || "Cliente",
        instancia: instanciaSelecionada !== "todas" ? instanciaSelecionada : undefined,
      }),
    });

    if (res.ok) {
      const novoAtendimento = await res.json();
      await fetchPageData(); // Atualizar lista de atendimentos
      if (novoAtendimento?.id) {
        setAtendimentoChat(novoAtendimento); // Abrir chat automaticamente
      }
    }
  } catch (err) {
    console.error("Erro ao criar atendimento:", err);
  }
}, [supabase, instanciaSelecionada, fetchPageData]);
```

> ⚠️ **Adapte** o payload do `POST /api/atendimentos` para o formato do projeto destino. O STK-CRM espera `{ telefone_cliente, nome_cliente, instancia }`.

---

## 8. Cuidados e armadilhas

### 🔴 Armadilha 1: EVOLUTION_INSTANCE errado no Vercel

**Problema:** A env var `EVOLUTION_INSTANCE` pode ter valor antigo (`minha-conexao`, `ROMA_2`, etc.).

**Solução:** Hardcode no `findContacts`:
```ts
const instanceName = instance || 'ROMA_1';  // NÃO use EVOLUTION_INSTANCE aqui
```

### 🔴 Armadilha 2: EVOLUTION_API_URL precisa ser IP público

**Problema:** O Vercel não consegue acessar `http://localhost:8082`.

**Solução:** Usar IP público: `http://2.25.192.248:8080`

### 🟡 Armadilha 3: Contatos com @lid em vez de @s.whatsapp.net

**Problema:** Alguns contatos retornam `remoteJid` no formato `...@lid` (IDs internos do WhatsApp), não `...@s.whatsapp.net`.

**Solução:** O `extractPhone` já trata ambos os formatos:
```ts
const extractPhone = (jid: string) => {
  return jid.replace("@s.whatsapp.net", "").replace("@lid", "");
};
```

### 🟡 Armadilha 4: pushName pode ser null

**Problema:** Contatos que não foram salvos na agenda podem não ter `pushName`.

**Solução:** Fallback para "Sem nome":
```tsx
<span>{contact.pushName || "Sem nome"}</span>
```

### 🟡 Armadilha 5: profilePicUrl pode ser null

**Problema:** Nem todos os contatos têm foto de perfil acessível.

**Solução:** Fallback para ícone:
```tsx
{contact.profilePicUrl ? (
  <img src={contact.profilePicUrl} ... />
) : (
  <UserPlus className="h-4 w-4 text-[#3B64CF]" />
)}
```

### 🟢 Armadilha 6: A busca é client-side

**Problema:** A Evolution API retorna TODOS os contatos e o filtro é feito no JavaScript.

**Solução:** Com 2.730 contatos, isso é aceitável. Se precisar de performance, usar search com debounce de 300ms (já implementado).

### 🟢 Armadilha 7: buildId do Vercel

**Problema:** O Vercel pode cachear builds antigos.

**Solução:** Se o deploy não atualizar, fazer `git commit --allow-empty -m "force redeploy"` e push.

---

## 9. Teste e validação

### Checklist de validação

```bash
# 1. Verificar se a Evolution API está acessível
curl -s "http://2.25.192.248:8080/instance/connectionState/ROMA_1" \
  -H "apikey: SUA_KEY" | python3 -m json.tool

# 2. Verificar busca de contatos
curl -s -X POST "http://2.25.192.248:8080/chat/findContacts/ROMA_1" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_KEY" \
  -d '{"where":{},"limit":5}' | python3 -m json.tool

# 3. Verificar verificação de números
curl -s -X POST "http://2.25.192.248:8080/chat/whatsappNumbers/ROMA_1" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_KEY" \
  -d '{"numbers":["5562999999999"]}' | python3 -m json.tool

# 4. Testar rota do Vercel (após deploy)
curl -s "https://SEU-PROJETO.vercel.app/api/whatsapp/contacts?limit=3"

# 5. Testar verificação no Vercel
curl -s -X POST "https://SEU-PROJETO.vercel.app/api/whatsapp/check-number" \
  -H "Content-Type: application/json" \
  -d '{"numbers":["5562999999999"]}'
```

### Testes manuais no browser

1. ✅ Botão "Novo Contato" aparece na toolbar
2. ✅ Modal abre ao clicar no botão
3. ✅ Contatos carregam automaticamente ao abrir
4. ✅ Busca por nome filtra os contatos
5. ✅ Busca por número filtra os contatos
6. ✅ Contatos com/sem foto de perfil aparecem corretamente
7. ✅ Badges "Salvo" e "Grupo" aparecem nos cards
8. ✅ Selecionar contato fecha o modal e cria atendimento
9. ✅ Chat abre automaticamente com o contato selecionado
10. ✅ Fechar modal (X ou backdrop) funciona

---

## Referências rápidas

| O que | Onde |
|-------|------|
| Função `findContacts` | `lib/evolution-api.ts` linha 319+ |
| Função `checkWhatsAppNumbers` | `lib/evolution-api.ts` linha 253+ |
| Rota GET contatos | `app/api/whatsapp/contacts/route.ts` |
| Rota POST verificação | `app/api/whatsapp/check-number/route.ts` |
| Componente modal | `components/features/atendimento/buscar-contatos-whatsapp.tsx` |
| Integração | `app/(dashboard)/atendimento/page.tsx` |

---

*Documento gerado automaticamente por Hermes Agent — STK-CRM v1.7.0*
