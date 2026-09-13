# 🔄 Integração Atendimento ↔ KANBAN (Oportunidades)

> Planejamento da integração entre o chat de atendimento e o KANBAN de oportunidades.
> Criado em: 2026-06-10
> Status: **Planejamento**

---

## 1. Visão Geral

O KANBAN de oportunidades será alimentado automaticamente a partir do atendimento. Quando o sistema detectar que um cliente enviou uma conta de energia (PDF ou imagem), sugere ao vendedor criar uma oportunidade no KANBAN com um clique.

```
ATENDIMENTO (WhatsApp)                    KANBAN (Oportunidades)
┌─────────────────────────┐              ┌─────────────────────────┐
│                         │              │                         │
│  Cliente: "Segue conta" │              │  📥 Recebeu a Conta     │
│  [PDF: conta_luz.pdf]   │───── ? ────▶ │  📝 Proposta a Fazer    │
│                         │              │  📋 Proposta Apresentada│
│  Sistema detecta:       │              │  🎤 Apresentação Feita  │
│  "Possível conta 📩"    │              │  📤 Contrato Enviado    │
│                         │              │  ✅ Contrato Assinado    │
│  [Criar Oportunidade]   │              │  💰 Comissão Paga       │
│                         │              │                         │
└─────────────────────────┘              └─────────────────────────┘
```

---

## 2. Renomeação: Tarefa → Oportunidade

### 2.1 O que muda

| Antes | Depois | Observação |
|-------|--------|------------|
| `tarefas` (tabela) | `oportunidades` (tabela) | Renomear ou criar nova |
| `coluna_kanban` | `etapa` | Mais claro |
| `KanbanTarefas` | `KanbanOportunidades` | Componente |
| `NovaTarefaModal` | `NovaOportunidadeModal` | Modal de criação |
| `ModalDetalhesTarefa` | `ModalDetalhesOportunidade` | Modal de detalhes |
| "Tarefa" na UI | "Oportunidade" na UI | Textos |

### 2.2 Colunas do KANBAN (etapas)

```typescript
const etapas = [
  { id: "recebeu_conta",      titulo: "Recebeu a Conta",      cor: "#5b9bd5", icone: "📥" },
  { id: "proposta_a_fazer",   titulo: "Proposta a Fazer",      cor: "#6ba3d6", icone: "📝" },
  { id: "proposta_apresentada",titulo: "Proposta Apresentada",  cor: "#7fb8e8", icone: "📋" },
  { id: "apresentacao_feita",  titulo: "Apresentação Feita",    cor: "#8cc5f0", icone: "🎤" },
  { id: "contrato_enviado",   titulo: "Contrato Enviado",      cor: "#a3d4ff", icone: "📤" },
  { id: "contrato_assinado",  titulo: "Contrato Assinado",     cor: "#34d399", icone: "✅" },
  { id: "comissao_paga",      titulo: "Comissão Paga",         cor: "#4ade80", icone: "💰" },
];
```

---

## 3. Detecção Automática de Conta

### 3.1 O que detectar

O sistema deve identificar quando o cliente envia:

| Tipo | Formato | Indicadores |
|------|---------|-------------|
| **PDF** | `.pdf` | Nome contém "conta", "fatura", "energia", "elétrica" |
| **Imagem** | `.jpg`, `.png`, `.webp` | OCR detecta: "UC", "kWh", "Consumo", "Vencimento", "Valor Total" |
| **Áudio** | `.ogg`, `.mp3` | Transcrição menciona "conta de luz", "fatura" (futuro) |

### 3.2 Regras de detecção

```typescript
// Padrões para identificar conta de energia
const padroesConta = {
  // No nome do arquivo
  nomes: [/conta/i, /fatura/i, /energia/i, /eletrica/i, /bill/i],
  
  // No conteúdo (OCR ou texto)
  conteudo: [
    /UC\s*[\d.\-\/]+/,           // Número da UC
    /consumo.*kWh/i,              // Consumo em kWh
    /vencimento.*\d{2}\/\d{2}/,   // Data de vencimento
    /valor.*total.*R\$/i,         // Valor total
    /bandeira.*(vermelha|amarela|verde|azul)/i, // Bandeira tarifária
    /energia\s*elétrica/i,        // "Energia Elétrica"
  ],
  
  // Exclusões (não é conta)
  exclusoes: [/comprovante/i, /recibo/i, /nota\s*fiscal/i],
};
```

### 3.3 Fluxo de detecção

```
Mensagem recebida no WhatsApp
  │
  ├─ É PDF ou imagem?
  │   ├─ SIM → Analisar nome + conteúdo
  │   │         ├─ Confiança alta (>80%) → Banner automático
  │   │         ├─ Confiança média (50-80%) → Banner com aviso
  │   │         └─ Confiança baixa (<50%) → Nada fazer
  │   └─ NÃO → Fim
  │
  └─ Analisar também:
      - Mensagem de texto: "enviei a conta", "segue fatura"
      - Resposta a pergunta do chatbot sobre conta
```

---

## 4. Interface no Atendimento

### 4.1 Banner de detecção

Quando o sistema detecta uma possível conta, aparece um banner discreto na área de mensagens:

```
┌─────────────────────────────────────────────────────┐
│ 📩 Possível conta de energia detectada              │
│                                                     │
│ [📊 Criar Oportunidade]    [✕ Dispensar]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Ao clicar "Criar Oportunidade"

```
┌─────────────────────────────────────────────────────┐
│  Criar Oportunidade                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cliente: João Pedro (62 99999-1234)                │
│  Tipo: [GD ▼]                                       │
│  UC: [266515901272    ]  (auto-preenchido se OCR)   │
│  Consumo: [1000] kWh                                │
│  Observação: [Conta enviada via WhatsApp     ]      │
│                                                     │
│  [Cancelar]              [Criar Oportunidade]       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.3 Botão manual (fallback)

Mesmo sem detecção automática, o vendedor pode criar manualmente:

```
Na barra de ações do atendimento:
[ 📊 Criar Oportunidade ]
```

---

## 5. Modelo de Dados

### 5.1 Tabela `oportunidades` (nova ou rename de `tarefas`)

```sql
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Vinculação
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  atendimento_id UUID REFERENCES atendimentos(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES profiles(id) NOT NULL,
  
  -- Dados da oportunidade
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'gd',  -- 'gd', 'reciee', 'axs'
  etapa TEXT NOT NULL DEFAULT 'recebeu_conta',
  prioridade TEXT DEFAULT 'media',
  
  -- Dados da conta/proposta
  uc TEXT,                          -- Unidade Consumidora
  consumo_kwh INTEGER,
  concessionaria TEXT,
  valor_proposta DECIMAL(10,2),
  valor_venda DECIMAL(10,2),       -- Valor final fechado
  
  -- Controle
  data_inicio DATE,
  hora_inicio TIME,
  data_fechamento DATE,
  resultado TEXT,                   -- 'sucesso', 'insucesso', 'perdida'
  motivo_resultado TEXT,
  
  -- Auditoria
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_oportunidades_vendedor ON oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa ON oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_oportunidades_atendimento ON oportunidades(atendimento_id);
```

### 5.2 Tabela `oportunidade_historico` (nova)

```sql
CREATE TABLE IF NOT EXISTS oportunidade_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oportunidade_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE,
  etapa_anterior TEXT,
  etapa_nova TEXT NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidade_historico_oportunidade 
  ON oportunidade_historico(oportunidade_id);
```

### 5.3 Tabela `oportunidade_alertas` (nova — para detecção)

```sql
CREATE TABLE IF NOT EXISTS oportunidade_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID REFERENCES atendimentos(id) ON DELETE CASCADE,
  mensagem_id UUID,                     -- ID da mensagem que gerou o alerta
  tipo TEXT NOT NULL,                   -- 'conta_detectada', 'manual'
  confianca REAL DEFAULT 0.5,          -- 0 a 1
  dados_extraidos JSONB,               -- UC, consumo, etc. (se OCR)
  status TEXT DEFAULT 'pendente',      -- 'pendente', 'aceito', 'rejeitado'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. APIs

### 6.1 Detectar conta (análise de mensagem)

```
POST /api/atendimentos/detectar-conta
Body: { mensagem_id, atendimento_id, conteudo, tipo_arquivo, nome_arquivo }

Response: {
  detectou: boolean,
  confianca: number,
  dados_extraidos: { uc?, consumo?, concessionaria? },
  sugestao: string
}
```

### 6.2 Criar oportunidade a partir do atendimento

```
POST /api/oportunidades
Body: {
  atendimento_id,
  cliente_id?,
  titulo,
  tipo,
  uc?,
  consumo_kwh?,
  observacao?
}

Response: { oportunidade }
```

### 6.3 APIs existentes (adaptar)

```
GET    /api/tarefas          → GET    /api/oportunidades
POST   /api/tarefas          → POST   /api/oportunidades
PATCH  /api/tarefas          → PATCH  /api/oportunidades
DELETE /api/tarefas          → DELETE  /api/oportunidades
GET    /api/tarefas/resumo   → GET    /api/oportunidades/resumo
```

---

## 7. Fluxo Completo

### 7.1 Fluxo automático (detecção)

```
1. Cliente envia PDF/imagem no WhatsApp
2. Webhook recebe mensagem → salva no banco
3. Sistema analisa mensagem:
   a. Nome do arquivo: "conta_luz_junho.pdf" → confiança 70%
   b. OCR/extração: "UC 266515901272", "Consumo 450 kWh" → confiança 90%
   c. Confiança final: 85%
4. Cria registro em `oportunidade_alertas` (status: pendente)
5. No atendimento, banner aparece:
   "📩 Possível conta de energia detectada (UC: 266515901272)"
6. Vendedor clica [Criar Oportunidade]
7. Modal abre com dados pré-preenchidos
8. Vendedor confirma → cria oportunidade na coluna "Recebeu a Conta"
9. Alerta marcado como "aceito"
```

### 7.2 Fluxo manual (botão)

```
1. Vendedor está conversando com cliente
2. Cliente diz "vou enviar a conta"
3. Conta chega (PDF ou imagem)
4. Vendedor clica [📊 Criar Oportunidade]
5. Modal abre (sem dados pré-preenchidos, ou com OCR se disponível)
6. Vendedor preenche: tipo (GD), UC, consumo
7. Cria oportunidade na coluna "Recebeu a Conta"
```

### 7.3 Progressão no KANBAN

```
📥 Recebeu a Conta
   │
   ▼ (vendedor clica "Proposta Pronta")
📝 Proposta a Fazer
   │
   ▼ (vendedor envia proposta)
📋 Proposta Apresentada
   │
   ▼ (apresentação realizada)
🎤 Apresentação Feita
   │
   ▼ (envia contrato)
📤 Contrato Enviado
   │
   ▼ (cliente assina)
✅ Contrato Assinado
   │
   ▼ (pagamento confirmado)
💰 Comissão Paga
```

---

## 8. Componentes a Criar/Modificar

### 8.1 Novos componentes

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `AlertaContaDetectada` | `components/features/atendimento/` | Banner de detecção |
| `ModalCriarOportunidade` | `components/features/atendimento/` | Modal de criação |
| `KanbanOportunidades` | `components/features/atendimento/` | Rename de `KanbanTarefas` |

### 8.2 Componentes a modificar

| Componente | Mudança |
|-----------|---------|
| `chat-inline.tsx` | Adicionar `AlertaContaDetectada` + botão manual |
| `modal-detalhes-tarefa.tsx` | Renomear para `ModalDetalhesOportunidade` |
| `nova-tarefa-modal.tsx` | Renomear para `NovaOportunidadeModal` |
| `performance-kanban.tsx` | Adaptar para nova tabela |
| `sidebar.tsx` | Renomear "Kanban" para "Oportunidades" |

### 8.3 Páginas a modificar

| Página | Mudança |
|--------|---------|
| `/kanban/page.tsx` | Renomear, usar nova API |

---

## 9. Fases de Implementação

### Fase 24 — Renomeação Tarefa → Oportunidade
- [ ] Criar tabela `oportunidades` (migration)
- [ ] Criar tabela `oportunidade_historico` (migration)
- [ ] Criar tabela `oportunidade_alertas` (migration)
- [ ] Migrar dados de `tarefas` para `oportunidades`
- [ ] Adaptar APIs (`/api/oportunidades`)
- [ ] Renomear componentes (Tarefa → Oportunidade)
- [ ] Atualizar sidebar

### Fase 25 — Detecção de Conta
- [ ] Criar API `/api/atendimentos/detectar-conta`
- [ ] Implementar análise de nome de arquivo
- [ ] Implementar OCR básico (extrair UC, consumo)
- [ ] Criar componente `AlertaContaDetectada`
- [ ] Integrar no `chat-inline.tsx`

### Fase 26 — Criação de Oportunidade
- [ ] Criar `ModalCriarOportunidade`
- [ ] Criar API `POST /api/oportunidades`
- [ ] Integrar com detecção (pré-preenchimento)
- [ ] Adicionar botão manual no atendimento
- [ ] Testar fluxo completo

### Fase 27 — KANBAN Adaptado
- [ ] Renomear `KanbanTarefas` → `KanbanOportunidades`
- [ ] Adaptar drag & drop para novas etapas
- [ ] Adicionar métricas de pipeline
- [ ] Histórico de movimentações

### Fase 28 — Métricas e Relatórios
- [ ] Dashboard de pipeline (oportunidades por etapa)
- [ ] Taxa de conversão por etapa
- [ ] Tempo médio em cada etapa
- [ ] Relatório de performance por vendedor

---

## 10. Perguntas para Definir

1. **OCR:** Usar API externa (Google Vision, AWS Textract) ou biblioteca local?
2. **Confiança mínima:** Qual % para mostrar o banner automaticamente?
3. **Múltiplos tipos:** Uma oportunidade pode ser GD + RECIEE ao mesmo tempo?
4. **Reabrir:** Se cliente desistir e voltar, cria nova oportunidade ou reabre a antiga?
5. **Permissões:** Vendedor pode mover qualquer oportunidade ou só as suas?
6. **Notificação:** Quando mover de etapa, notifica alguém (gestor)?
7. **Integração AXS:** Oportunidade AXS segue mesmo fluxo ou é diferente?

---

## 11. Notas Técnicas

- **Migração:** Criar tabela nova `oportunidades` e migrar dados de `tarefas` com `INSERT INTO ... SELECT`
- **RLS:** Manter RLS por `vendedor_id` (cada vendedor vê suas oportunidades)
- **Gestores:** Adicionar política para gestores verem todas as oportunidades
- **Performance:** Indexar por `etapa` e `vendedor_id` para queries rápidas no KANBAN
- **Cache:** Considerar cache para métricas de dashboard (atualizar a cada 30s)
