# Plano de Reorganização do Disparo

> Origem: documento **"PROPOSTA DE REORGANIZAÇÃO DO APLICATIVO — Arquitetura da
> informação, fluxo operacional e diretrizes de interface para desenvolvimento"**
> (PDF recebido do João em 25/11/2026, 10 páginas).
>
> Este arquivo é o runbook: qualquer sessão futura lê isto antes de mexer no
> Disparo. O documento pede explicitamente **validar antes de alterar código** —
> as validações estão na seção 2.

---

## 1. O que a proposta pede

**Menu único do aplicativo de disparo WhatsApp**, com 7 itens:

1. Visão Geral
2. Campanhas
3. Disparos
4. Contatos e Listas
5. Relatórios
6. Modelos de Mensagens
7. Configurações

**Quatro blocos funcionais:**

- **A. Gestão de Sessões WhatsApp** — cadastrar número, parear QR, status,
  selecionar qual número envia, detectar desconexão.
- **B. Criação de Disparo** — nome, público (lista / segmentação), conteúdo
  (texto, imagem, fluxo com intervalos), data/hora agendada, número de origem,
  validação de números, pré-visualização.
- **C. Acompanhamento de Disparo** — indicadores: disparos realizados, enviados,
  falhos, entregues, visualizados, agendados, cancelados; filtros por período,
  status e campanha; gráfico de volume; status por número; exportar relatório.
- **D. Integrações** — conectar WhatsApp, verificar sessão, testar envio.

**Três fases no documento:** Fase 1 (sessões + estado do disparo + criação) →
Fase 2 (reorganização das telas) → Fase 3 (contatos/listas, modelos, relatórios,
integrações).

**Orientação final do próprio documento:** validar 4 pontos antes de codar —
(a) quais eventos a integração de WhatsApp realmente fornece; (b) como os números
estão armazenados/consolidados; (c) quais estados de disparo já existem;
(d) quais funcionalidades podem ser preservadas sem migração estrutural.

---

## 2. As 4 validações respondidas no código (25/11/2026)

### (a) Eventos que a integração de fato entrega

| Evento | Existe? | Onde |
|---|---|---|
| Enviado / Falhou | ✅ sim | `disparo_logs` (`status: ok\|err`), por contato **e** por passo, gravado pelo worker |
| Entregues | ❌ não persiste | webhook `/api/webhooks/waha` recebe `message.ack`, tenta gravar `ack_status` em `atendimento_mensagens` — **não existe migration com essa coluna**, então o update falha em silêncio |
| Visualizados | ❌ não persiste | idem |
| Conversão (respondeu) | ⚠️ parcial | `api/bulk/resultado-remarketing` cruza `disparo_logs` com `atendimento_mensagens` |

**Conclusão:** indicadores "Entregues" e "Visualizados" **não podem ser exibidos
hoje**. A tubulação (evento `message.ack`) já chega; falta migration de coluna +
contadores em `bulk_campaigns`.

### (b) Como os números estão guardados

- `bulk_campaigns.numbers` = **array JSONB de strings crus** (sem normalização).
- Fontes de número: planilha importada (estado no cliente), tabela
  `leads_marketing`, `clientes.telefone`.
- **Não existe tabela de listas** de contatos.
- **Não existe deduplicação** na importação.
- **Não existe exclusão do número da própria empresa**.
- Existe `remarketing_opt_out` (migration 090) — opt-out parcial, só remarketing.

### (c) Estados de disparo que já existem

`bulk_campaigns.status`: `pending`, `rascunho`, `running`, `paused`,
`completed`, `failed`.
`campanhas.status`: `rascunho`, `agendada`, `ativa`, `pausada`, `finalizada`.

O documento quer: Rascunho, Agendado, Validando, Enviando, Concluído, Pausado,
Cancelado, Falhou.

| Estado desejado | Situação |
|---|---|
| Rascunho | ✅ existe (`rascunho`) |
| Agendado | ❌ **não existe** — não há agendamento: o envio vira `running` na hora (o `agendador.py` do worker cuida de rotinas de negócio, não de disparo) |
| Validando | ❌ não existe (etapa de checagem antes de enviar) |
| Enviando | ✅ existe (`running`) |
| Concluído | ✅ existe (`completed`) |
| Pausado | ✅ existe (`paused`) — com retomada por `offset = sent + failed` |
| Cancelado | ❌ não existe |
| Falhou | ✅ existe (`failed`) |

**Faltam 3 estados:** Agendado, Validando, Cancelado.

### (d) Preservável sem migração estrutural

Tudo que já funciona e não precisa mudar de forma:

- builder de fluxo de mensagens com intervalos (`fluxo_mensagens`, migrations 079/080/081)
- variáveis `{{nome}}` / `{{telefone}}`
- imagem no disparo (`imagem_url`)
- público de remarketing + resultado pós-disparo
- **reenivar só as falhas** (`POST /api/bulk/campaigns/reenviar`, TDD, 5 testes)
- pausa/retomada por offset
- meta de mensagens com barra de progresso (`meta`, migration 104)
- logs por contato (`disparo_logs`)
- badges de origem: Avulso / Em Massa / Remarketing / Campanha
- lista de instâncias (`GET /api/instances`)

---

## 3. Mapa do que existe hoje

**Rotas**

| Rota | Conteúdo |
|---|---|
| `/disparo` | era 3 seções empilhadas numa página comprida: Painel de Envios, Disparos, Relatórios → **virou abas (ver seção 4)** |
| `/marketing/campanhas` | casca fina de `CampanhasConteudo` (histórico + diálogo "Novo Disparo") |
| `/marketing/relatorios` | `RelatoriosConteudo` |
| `/marketing/dashboard` | métricas de marketing |
| `/campanhas` | ⚠️ **página órfã de mock** (gamificação hardcoded: "Viagem para Cancun", ranking, conquistas). Não está no sidebar. Candidata a remoção |

**Componentes**

- `components/features/disparo/bulk-sender.tsx` (1.170 linhas) — Painel de Envios,
  abas Avulso/Massa/Remarketing, indicadores, badges de origem
- `components/features/campanhas/campanhas-conteudo.tsx` (2.032 linhas) —
  histórico de campanhas + criação de disparo
- `components/features/disparo/configuracoes-disparo.tsx` — **novo nesta rodada**

**API** — `/api/bulk/{campaigns,send,status,publico-remarketing,resultado-remarketing,campaigns/reenviar}`,
`/api/instances`, `/api/whatsapp/status`, `/api/marketing/*`

**Worker** — `worker/disparo_worker_waha.py`: polling de 5s em
`bulk_campaigns.status='running'`, envio via WAHA, contadores `sent`/`failed`,
logs, pausa/retomada. Testes: `python3 -m unittest test_disparo_worker`

**Tabelas** — `bulk_campaigns` (069/077/078/079/080/081/104), `campanhas` (071),
`disparo_logs`, `leads_marketing`, `remarketing_opt_out`

---

## 4. O que foi feito nesta rodada (25/11/2026)

**Decisão (assumida pelo agente, João mandou seguir):** enquanto a sidebar não
tiver suporte a menu aninhado (é **plana** — nenhum `children` no
`components/layout/sidebar.tsx`), a reorganização vira **navegação em abas
dentro da rota `/disparo`**, com as seções do documento na ordem dele.

Implementado:

1. **`app/(dashboard)/disparo/page.tsx`** — reescrito de 3 seções empilhadas
   para `Tabs` com 4 abas: **Visão Geral** (Painel de Envios), **Disparos**
   (histórico + Novo Disparo), **Relatórios**, **Configurações**.
   Só a aba ativa renderiza (as outras desmontam) — deixa de carregar 3 blocos
   pesados de uma vez.
2. **`components/features/disparo/configuracoes-disparo.tsx`** — novo. Consome
   `GET /api/instances` (dado real do WAHA): lista sessões com número e status
   aberta/fechada, resumo, botão de atualizar e instrução de pareamento.
   Não inventa status nenhum.
3. **Testes:** `app/(dashboard)/disparo/page.test.tsx` (reescrito, 5 casos) +
   `components/features/disparo/configuracoes-disparo.test.tsx` (novo, 5 casos).

**Gates:** `npx tsc --noEmit` ✅ · `npx vitest run` nos arquivos alterados ✅ 16/16

> ⚠️ **Pitfall anotado:** o Radix `Tabs` seleciona a aba no **`mousedown`**, não
> no `click`. Em teste, `fireEvent.click` sozinho não troca de aba — disparir
> `fireEvent.mouseDown` + `fireEvent.click` (no navegador os dois saem juntos,
> então não é bug de produção).

---

## 5. Fases seguintes

### Fase A — dados do disparo (libera os indicadores da proposta)
- Migration: coluna `ack_status` em `atendimento_mensagens` (o webhook já tenta
  gravar e falha em silêncio)
- Migration: `delivered` e `read_count` em `bulk_campaigns`
- Webhook `message.ack` passa a atualizar o disparo de origem
- **Aceite:** criar um disparo, entregar em número real, indicador "Entregues"
  sobe; teste automatizado no webhook

### Fase B — estados que faltam
- `agendado` (com agendador disparando no horário), `validando`, `cancelado`
- **Aceite:** agendar um disparo para +10 min e ele sair sozinho; cancelar um
  rascunho sem deixar lixo no worker

### Fase C — menu de verdade (sub-módulo do Disparo)
- Estender o tipo de item do sidebar com `children` e renderizar aninhado
  (a renderização é plana hoje: `navItems.map(item => <Link>)`)
- Mover `/disparo` para `/disparo/visao-geral` + 3 sub-rotas, com redirect
- **Aceite:** sidebar mostra Visão Geral / Disparos / Relatórios / Configurações
  sob "Disparo"; `npm test` + `tsc` verdes

### Fase D — Contatos e Listas (não existe)
- Tabela `listas_contatos` + CRUD + importação com **deduplicação** e **exclusão
  do número da própria empresa**
- **Aceite:** importar planilha com 3 números repetidos → lista mostra 1

### Fase E — Modelos de Mensagens (não existe)
- Entidade própria de modelo (hoje só há vizinhos: `artes_textos`,
  `base_conhecimento`)
- **Aceite:** salvar um modelo e reusá-lo num disparo

### Fase F — limpeza
- Remover `/campanhas` (mock de gamificação órfã) e a entrada `"/campanhas"`
  do `routeTitles` em `components/layout/header.tsx`

---

## 6. Gates obrigatórios (STK-CRM)

```bash
cd /root/stk-crm
npm test                  # vitest
npx tsc --noEmit          # tipos
cd worker && python3 -m unittest test_disparo_worker   # se mexer no worker
```

Bateria de usabilidade (cliques reais no navegador) só no fim, conforme prática
permanente do João.
