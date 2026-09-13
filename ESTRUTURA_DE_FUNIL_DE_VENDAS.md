# 🏗️ Estrutura de Funil de Vendas — STK CRM

> Documento de referência para implementação do funil de vendas completo.
> Criado em: 2026-06-10
> Status: **Planejamento**

---

## 1. Visão Geral

O funil de vendas organiza cada contato em **estágios progressivos**, desde o primeiro disparo até o fechamento. Cada estágio representa o nível de engajamento e valor do contato para a STK.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PROSPECTO   │───▶│    LEAD     │───▶│   CLIENTE   │
│   (frio)     │    │  (morno)    │    │  (fechado)  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       │                  │                  │
    Disparo          Respondeu +         Fechou proposta
    sem resposta     demonstrou          ou contrato
                     interesse
```

### Estágios

| Estágio | Significado | Cadastro | Propostas | Exemplo |
|---------|------------|----------|-----------|---------|
| **PROSPECTO** | Foi contatado, sem interação significativa | Não | Não | Número que recebeu disparo e não respondeu |
| **LEAD** | Demonstou interesse, aberto a propostas | Básico (nome, telefone) | Pode criar GD/RECIEE | Respondeu "quero saber mais" no chatbot |
| **CLIENTE** | Fechou negócio, tem proposta/contrato | Completo (CPF, endereço, etc.) | Já tem proposta ativa | Proposta GD aprovada, contrato RECIEE assinado |

### Estágio Opcional

| Estágio | Significado | Regra |
|---------|------------|-------|
| **INATIVO** | Lead que esfriou (sem interação há X dias) | Automático após 15 dias sem resposta, ou manual |

---

## 2. Regras de Transição

### 2.1 Transições Automáticas (via sistema)

```
PROSPECTO → LEAD
  Trigger: Respondeu mensagem de disparo OU completou chatbot
  Ação: Cria registro básico em `clientes` (nome, telefone)
  Exceção: Resposta negativa explícita ("não quero", "remova") → fica PROSPECTO

LEAD → INATIVO
  Trigger: 15 dias sem nenhuma interação (mensagem enviada/recebida)
  Ação: Status muda automaticamente
  Exceção: Lead com proposta ativa NÃO fica inativo
```

### 2.2 Transições Manuais (via vendedor)

```
PROSPECTO → LEAD
  Ação: Vendedor cadastra o contato manualmente no painel

LEAD → CLIENTE
  Ação: Vendedor cria proposta GD/RECIEE/AXS e ela é aprovada
  
CLIENTE → LEAD
  Ação: Vendedor rebaixa (proposta cancelada, cliente desistiu)
  Observação: Rare, mas necessário

INATIVO → LEAD
  Ação: Reativação manual OU novo disparo que gera resposta
```

### 2.3 Regras de Proteção

- **LEAD não vira PROSPECTO** — uma vez que demonstrou interesse, não volta pra frio
- **CLIENTE com proposta ativa** não pode ser deletado
- **Transições ficam registradas** em tabela de histórico (auditoria)
- **Chatbot pode promover** PROSPECTO → LEAD automaticamente

---

## 3. Modelo de Dados

### 3.1 Tabela `clientes` (modificação)

```sql
-- Campo existente: classificacao (já existe na tabela)
-- Será renomeado/reutilizado para 'estagio'

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estagio TEXT 
  DEFAULT 'lead' CHECK (estagio IN ('prospecto', 'lead', 'cliente', 'inativo'));

-- Criar índice para filtros rápidos
CREATE INDEX IF NOT EXISTS idx_clientes_estagio ON clientes(estagio);

-- Migrar dados existentes baseado em regras:
-- - Se tem proposta (GD/RECIEE/AXS) → 'cliente'
-- - Se foi cadastrado manualmente ou via chatbot → 'lead'
-- - Restante → 'prospecto'
```

### 3.2 Tabela `estagio_historico` (nova)

```sql
CREATE TABLE IF NOT EXISTS estagio_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  estagio_anterior TEXT,
  estagio_novo TEXT NOT NULL,
  motivo TEXT, -- 'automatico', 'manual', 'chatbot', 'reativacao'
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_estagio_historico_cliente ON estagio_historico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_estagio_historico_data ON estagio_historico(created_at);
```

### 3.3 Tabela `campanhas` / `bulk_campaigns` (modificação)

```sql
-- Já temos bulk_campaigns. Adicionar rastreio de conversão:
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS prospectos_gerados INTEGER DEFAULT 0;
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS leads_gerados INTEGER DEFAULT 0;
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS clientes_gerados INTEGER DEFAULT 0;
```

### 3.4 View `v_unified_clientes` (modificação)

```sql
-- Adicionar campo estagio à view unificada
-- Manter compatibilidade com campos existentes
```

---

## 4. Fluxos por Recurso

### 4.1 Disparo em Massa (Marketing)

```
Disparo enviado
  ↓
  └─→ Cada contatorecebe mensagem
        ↓
        ├─ Sem resposta em 24h → estagio = 'prospecto'
        ├─ Respondeu positivo → estagio = 'lead' (automático)
        └─ Respondeu negativo → estagio = 'prospecto' (não promove)

Métricas da campanha:
  - Enviados: 100
  - Prospectos: 60 (não responderam)
  - Leads: 35 (responderam)
  - Clientes: 5 (fecharam)
  - Taxa de conversão: 5%
```

### 4.2 Chatbot

```
Chatbot inicia conversa
  ↓
  └─→ Lead responde perguntas
        ↓
        ├─ Completou cadastro → estagio = 'lead'
        ├─ Interessado em proposta → estagio = 'lead' + criar proposta
        └─ Desistiu → estagio = 'lead' (não rebaixa)
```

### 4.3 Atendimento (Painel do Vendedor)

```
Vendedor abre conversa
  ↓
  └─→ Painel mostra estágio atual
        ↓
        ├─ Se PROSPECTO → botão "Cadastrar como Lead"
        ├─ Se LEAD → botões "Criar Proposta GD/RECIEE"
        └─ Se CLIENTE → mostrar propostas existentes

Ao cadastrar:
  → Estágio = 'lead'
  → Registrar em estagio_historico

Ao criar proposta:
  → Se aprovada → estagio = 'cliente'
  → Registrar em estagio_historico
```

### 4.4 Página de Clientes (Listagem)

```
Filtros adicionados:
  - Todos (padrão)
  - Prospectos
  - Leads
  - Clientes
  - Inativos

Coluna "Estágio" com badge colorido:
  - PROSPECTO → cinza
  - LEAD → azul
  - CLIENTE → verde
  - INATIVO → vermelho escuro

Métricas no topo:
  - Total de prospectos
  - Total de leads
  - Total de clientes
  - Taxa de conversão geral
```

---

## 5. UI/UX

### 5.1 Badge de Estágio

```tsx
// Cores por estágio
const estagioCores = {
  prospecto: { bg: "bg-slate-600", text: "text-slate-200", label: "Prospecto" },
  lead:      { bg: "bg-blue-600",  text: "text-blue-100",  label: "Lead" },
  cliente:   { bg: "bg-green-600", text: "text-green-100", label: "Cliente" },
  inativo:   { bg: "bg-red-900",   text: "text-red-300",   label: "Inativo" },
};
```

### 5.2 Painel de Atendimento

```
┌─────────────────────────────────────────┐
│  João Pedro                    [Lead 🔵]│
│  (62) 99999-1234                        │
├─────────────────────────────────────────┤
│  [Enviar] [Criar Proposta] [Ver Lead]   │
│                                         │
│  Mensagens...                           │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Dashboard de Métricas

```
┌─────────────────────────────────────────────────┐
│  FUNIL DE VENDAS - Junho 2026                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Prospectos: ████████████████░░░░░  180         │
│  Leads:      ████████░░░░░░░░░░░░░   80         │
│  Clientes:   ██░░░░░░░░░░░░░░░░░░░   15         │
│                                                 │
│  Conversão Prospecto→Lead:   44%                │
│  Conversão Lead→Cliente:     19%                │
│  Conversão Geral:             8%                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 6. Fases de Implementação

### Fase 18 — Fundação do Funil ✅ Próximo
- [ ] Criar campo `estagio` na tabela `clientes`
- [ ] Criar tabela `estagio_historico`
- [ ] Migration SQL para migrar dados existentes
- [ ] Criar badge de estágio (componente reutilizável)
- [ ] Adicionar estágio na listagem de clientes

### Fase 19 — Transições Automáticas
- [ ] Webhook promover PROSPECTO → LEAD quando responde disparo
- [ ] Chatbot promover para LEAD ao completar cadastro
- [ ] Verificação de INATIVO (cron job diário)
- [ ] Proteção: cliente com proposta ativa não muda de estágio

### Fase 20 — Integração com Atendimento
- [ ] Mostrar estágio no painel lateral
- [ ] Botão "Cadastrar como Lead" para prospects
- [ ] Botão "Marcar como Cliente" ao criar proposta
- [ ] Histórico de transições visível no painel

### Fase 21 — Métricas e Dashboard
- [ ] Métricas de conversão por campanha
- [ ] Dashboard de funil (gráfico de barras/funnel)
- [ ] Filtro por estágio na listagem de clientes
- [ ] Relatório de conversão mensal

### Fase 22 — Automação Avançada
- [ ] Reativação automática de leads inativos
- [ ] Scoring de leads (baseado em interações)
- [ ] Notificações para vendedores quando lead aquece
- [ ] Integração com WhatsApp (envio de reativação)

---

## 7. Perguntas para Decidir

Antes de implementar, definir:

1. **Tempo para INATIVO:** 15 dias sem interação? 30? Configurável?
2. **Quem pode mudar estágio manualmente?** Só admin? Vendedores também?
3. **Lead com proposta rejeitada:** Fica LEAD ou volta pra PROSPECTO?
4. **Reativação:** Automática (novo disparo) ou só manual?
5. **Métricas:** Precisa de dashboard dedicado ou só filtros na listagem?
6. **Integração com chatbot:** Chatbot já promove sozinho ou precisa de intervenção?

---

## 8. Notas Técnicas

- **Campo `classificacao`** já existe em `clientes` — pode ser renomeado para `estagio` ou mantido separado (classificação é tipo de cliente, estágio é momento no funil)
- **A view `v_unified_clientes`** já busca de múltiplas tabelas — precisa incluir o campo `estagio`
- **O painel de atendimento** (`painel-contato.tsx`) já tem botões de ação — adicionar estágio é natural
- **Compatibilidade:** Manter `classificacao` para categorias (GD, RECIEE, AXS) e usar `estagio` para funil
- **Auditoria:** Toda transição registra em `estagio_historico` — nunca perder histórico
