# 🏗️ Estrutura de Funil de Vendas — STK CRM

> Documento de referência para implementação do funil de vendas completo.
> Criado em: 2026-06-10 | Atualizado: 2026-06-10
> Status: **Planejamento**

---

## 1. Visão Geral — Separação Marketing × CRM

O sistema se divide em duas áreas com papéis distintas:

```
┌─────────────────────────────────────────────────────────────────┐
│                         MARKETING                               │
│                   (topo do funil)                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PROSPECTOS  │  │    LEADS     │  │   Dashboard de Funil │  │
│  │  (frio)      │──│  (morno)     │  │   Métricas, Taxas    │  │
│  │              │  │              │  │   Conversão           │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────┘  │
│                           │                                     │
│  Disparos / Chatbot       │  Quando fecha proposta              │
│                           ▼                                     │
├─────────────────────────────────────────────────────────────────┤
│                          CRM                                    │
│                   (fundodo funil)                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   CLIENTES   │  │    KANBAN    │  │   Dashboard de Vendas│  │
│  │  (fechado)   │  │  Propostas   │  │   Receita, Pipeline  │  │
│  │              │  │  Contratos   │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Regra fundamental

- **MARKETING** = onde o lead nasce, cresce e é qualificado
- **CRM** = onde o cliente é gerenciado após o fechamento
- **Transição:** Lead → Cliente acontece quando o cliente **fecha/proposta aprovada**

---

## 2. Estágios do Funil

| Estágio | Onde vive | Significado | Cadastro | Propostas |
|---------|-----------|------------|----------|-----------|
| **PROSPECTO** | Marketing | Foi contatado, sem interação | Não | Não |
| **LEAD** | Marketing | Demonstou interesse | Básico (nome, telefone) | Pode criar GD/RECIEE |
| **CLIENTE** | CRM | Fechou negócio | Completo (CPF, endereço) | Já tem proposta ativa |

### Estágio Opcional

| Estágio | Onde vive | Regra |
|---------|-----------|-------|
| **INATIVO** | Marketing | Lead sem interação há 15+ dias (automático ou manual) |

---

## 3. Regras de Transição

### 3.1 Automações (sistema faz sozinho)

```
PROSPECTO → LEAD
  Trigger: Respondeu disparo OU completou chatbot
  Ação: Cria registro básico (nome, telefone)
  Exceção: Resposta negativa explícita → fica PROSPECTO

LEAD → INATIVO
  Trigger: 15 dias sem nenhuma interação
  Exceção: Lead com proposta ativa NÃO fica inativo
```

### 3.2 Manuais (vendedor faz)

```
PROSPECTO → LEAD
  Ação: Vendedor cadastra no painel de atendimento

LEAD → CLIENTE
  Ação: Proposta GD/RECIEE/AXS aprovada pelo cliente
  IMPORTANTE: Só aqui vira cliente — não ao criar proposta

CLIENTE → LEAD
  Ação: Vendedor rebaixa (proposta cancelada, desistiu)

INATIVO → LEAD
  Ação: Reativação manual OU novo disparo com resposta
```

### 3.3 Fluxo completo num ciclo

```
Disparo enviado (100 contatos)
  │
  ├─ 60 não responderam → PROSPECTO
  ├─ 35 responderam → LEAD
  └─ 5 fecharam → CLIENTE

 Leads (35):
  ├─ 20 interagiram, vendedor cadastrou → LEAD
  ├─ 10 criaram proposta → LEAD (com proposta pendente)
  └─ 5 proposta aprovada → CLIENTE (move pra CRM)
```

---

## 4. Modelo de Dados

### 4.1 Tabela `clientes` (modificação)

```sql
-- Campo estagio (novo)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estagio TEXT
  DEFAULT 'lead' CHECK (estagio IN ('prospecto', 'lead', 'cliente', 'inativo'));

CREATE INDEX IF NOT EXISTS idx_clientes_estagio ON clientes(estagio);

-- Migrar dados existentes:
-- - Se tem proposta (clientes_gd ou clientes_reciee) → 'cliente'
-- - Se foi cadastrado (tem nome_razao_social) → 'lead'
-- - Restante → 'prospecto'
```

### 4.2 Tabela `estagio_historico` (nova)

```sql
CREATE TABLE IF NOT EXISTS estagio_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  estagio_anterior TEXT,
  estagio_novo TEXT NOT NULL,
  motivo TEXT,         -- 'automatico', 'manual', 'chatbot', 'fechamento', 'reativacao'
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estagio_historico_cliente ON estagio_historico(cliente_id);
```

### 4.3 Tabela `bulk_campaigns` (modificação)

```sql
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS prospectos_gerados INTEGER DEFAULT 0;
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS leads_gerados INTEGER DEFAULT 0;
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS clientes_gerados INTEGER DEFAULT 0;
```

---

## 5. Interface — Onde aparece

### 5.1 Marketing → Nova Aba "Leads"

```
┌─────────────────────────────────────────────────────────┐
│  MARKETING > LEADS                                      │
├─────────────────────────────────────────────────────────┤
│  [ Prospectos (60) ] [ Leads (35) ] [ Inativos (5) ]   │
├─────────────────────────────────────────────────────────┤
│  🔍 Buscar...                    [Filtro estágio ▼]    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Nome        │ Telefone   │ Origem   │ Estágio   │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ João Silva  │ 62 999...  │ Disparo  │ 🔵 Lead   │   │
│  │ Maria Santos│ 62 988...  │ Chatbot  │ ⚪ Prospect│   │
│  │ Pedro Lima  │ 62 977...  │ Disparo  │ 🔵 Lead   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Ao clicar no lead → abre atendimento (painel lateral)  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Marketing → Dashboard de Funil

```
┌─────────────────────────────────────────────────────────┐
│  MARKETING > DASHBOARD                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FUNIL DE VENDAS — Junho 2026                           │
│                                                         │
│  Prospectos: ████████████████░░░░░  180                 │
│  Leads:      ████████░░░░░░░░░░░░░   80                 │
│  Clientes:   ██░░░░░░░░░░░░░░░░░░░   15                 │
│                                                         │
│  Conversão Prospecto→Lead:   44%                        │
│  Conversão Lead→Cliente:     19%                        │
│  Conversão Geral:             8%                        │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Por Campanha:                                          │
│  Disparo Junho: 120 envios → 30 leads → 5 clientes     │
│  Chatbot:        80 sessões → 50 leads → 10 clientes   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.3 CRM → Só Clientes

```
┌─────────────────────────────────────────────────────────┐
│  CRM > CLIENTES                                         │
├─────────────────────────────────────────────────────────┤
│  (mantém como está hoje — só aparecem quem fechou)      │
│                                                         │
│  KANBAN:                                                │
│  [ Proposta Enviada ] [ Negociação ] [ Fechado ]        │
│                                                         │
│  Dashboard de Vendas:                                   │
│  - Propostas ativas                                     │
│  - Receita pipeline                                     │
│  - Tempo médio de fechamento                            │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Atendimento (integrado)

```
┌─────────────────────────────────────────────────────────┐
│  CONVERSA — João Pedro                   [🔵 Lead]      │
├─────────────────────────────────────────────────────────┤
│  Mensagens...                                           │
│                                                         │
│  [Enviar] [Criar Proposta GD] [Cadastrar] [Ver Lead]   │
│                                                         │
│  Status: Lead — aguardando proposta                     │
└─────────────────────────────────────────────────────────┘

Quando proposta é aprovada:
  → Botão: "Mover para CRM (Cliente)"
  → ou automático ao marcar proposta como "aprovada"
```

---

## 6. Badge de Estágios

```tsx
const estagioConfig = {
  prospecto: { cor: "bg-slate-600",  texto: "text-slate-200",  icone: "⚪", label: "Prospecto" },
  lead:      { cor: "bg-blue-600",   texto: "text-blue-100",   icone: "🔵", label: "Lead" },
  cliente:   { cor: "bg-green-600",  texto: "text-green-100",  icone: "🟢", label: "Cliente" },
  inativo:   { cor: "bg-red-900",    texto: "text-red-300",    icone: "⚫", label: "Inativo" },
};
```

---

## 7. Fases de Implementação

### Fase 18 — Fundação do Funil
- [ ] Campo `estagio` na tabela `clientes`
- [ ] Tabela `estagio_historico`
- [ ] Migration de dados existentes
- [ ] Componente `BadgeEstagio`

### Fase 19 — Tela de Leads (Marketing)
- [ ] Nova aba "Leads" dentro de Marketing
- [ ] Tabs: Prospectos | Leads | Inativos
- [ ] Listagem com busca e filtros
- [ ] Clique no lead → abre atendimento

### Fase 20 — Transições Automáticas
- [ ] Webhook: resposta de disparo promove → LEAD
- [ ] Chatbot promove → LEAD ao cadastrar
- [ ] Cron job: verifica INATIVO (15 dias)
- [ ] Proteção: cliente com proposta não muda

### Fase 21 — Integração CRM
- [ ] "Mover para CRM" ao aprovar proposta
- [ ] KANBAN recebe novos clientes automaticamente
- [ ] Dashboard de vendas (propostas, receita)

### Fase 22 — Dashboard de Funil (Marketing)
- [ ] Métricas de conversão por campanha
- [ ] Gráfico de funil (barras ou funnel chart)
- [ ] Relatório mensal exportável

### Fase 23 — Automação Avançada
- [ ] Reativação de leads inativos
- [ ] Scoring de leads
- [ ] Notificações para vendedores

---

## 8. Perguntas para Definir

1. **Lead com proposta rejeitada:** Fica LEAD ou volta pra PROSPECTO?
2. **Quem move pra CRM?** Automático ao aprovar ou manual?
3. **KANBAN:** Já existe ou precisa criar do zero?
4. **Dashboard Marketing:** Precisa de gráficos ou só números?
5. **Permissões:** Vendedor pode mudar estágio de qualquer lead?

---

## 9. Compatibilidade

- **Campo `classificacao`** continua existindo (tipo: GD, RECIEE, AXS)
- **Campo `estagio`** é separado (momento no funil: prospecto, lead, cliente)
- **`v_unified_clientes`** será atualizada para incluir `estagio`
- **Painel de atendimento** já tem botões de ação — adicionar estágio é natural
- **APIs existentes** continuam funcionando — `estagio` é additive
