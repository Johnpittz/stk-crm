# Plano de Ação — Módulos CRM / MARKETING (STK-CRM)

> **Status:** **Fase 0 CONCLUÍDA e no ar em 26/09/2026** (F0.1+F0.2+F0.3, migrations 087/088
> aplicadas, deploy, worker publicado). Próxima: **Fase 1** (C1 + C2), aguardando GO.
> **Verificação:** 26/09/2026 (checado no código/banco/repositório, não em docs). **Respostas do João incorporadas:** 26/09/2026.
> **Método:** TDD (RED → GREEN → REFACTOR). **Sem prazos aqui:** escopo, dependências e ordem — prazo é outra coisa.
> **Documento divisor (obrigatório ler ao iniciar qualquer sessão):** `docs/HANDOFF.md`

---

## 0. Fatos verificados que sustentam todo o plano

| Fato | Evidência |
|---|---|
| Perfis separados na sidebar (CRM / Marketing / Pós-Vendas / Admin) | `components/layout/sidebar.tsx` (`navItemsPorPerfil`) |
| `atendimentos` já tem `ultima_mensagem_data`, `ultima_mensagem_remetente`, `nao_lido`, `status` | `setup-database.sql`; usados em `app/api/atendimentos/page-data/route.ts` |
| Hoje esses campos só servem para exibir "Você: ..." na lista — **não existe filtro de "sem resposta"** | `components/features/atendimento/lista-atendimentos-lateral.tsx:151` |
| Tabela de notificações existe, sino existe, polling existe… mas a tabela está **VAZIA (0 linhas)** — nada nunca foi notificado | consulta REST `notificacoes` (0 linhas) |
| Dois bugs que explicam isso: insert sem `user_id` (NOT NULL) e `tipo` fora do CHECK (`'chatbot'`, `'meta_atingida'` não estão no constraint) | `lib/chatbot/engine.ts:674`, `app/api/chatbot/route.ts:86`, `supabase/migrations/009_notificacoes.sql` |
| CHECK de `notificacoes.tipo` aceita só 5 valores → qualquer alerta novo exige migration | `supabase/migrations/009_notificacoes.sql` |
| `oportunidades` tem `updated_at` (base do "kanban parado") | `supabase/migrations/084_tarefa_to_oportunidade.sql` |
| `oportunidade_alertas` já existe mas é pra detecção de conta e **não tem 1 uso no código** | `084...sql` + grep (`0` ocorrências em `app/`/`lib/`/`components/`) |
| Funil tem 7 etapas: `recebeu_conta → proposta_feita → proposta_apresentada → apresentacao_realizada → contrato_enviado → contrato_assinado → comissao_paga` | `components/features/atendimento/kanban-oportunidades.tsx:28-35` |
| AXS: integração real existe (`/api/axs/sync` login na IRIS, `/api/axs/send` → Playwright na VPS `2.25.192.248:8080/axs-api`, tabela `axs_propostas` com `axs_status`) | `app/api/axs/*`, `supabase/migrations/078_axs_propostas_table.sql` |
| **Não existe fila de propostas** em nenhum lugar (grep por "fila"/"espera": zero) e não está documentada | — |
| `/disparo` (BulkSender) existe mas **não tem link em nenhum lugar da navegação** — só por URL direta; dentro de Marketing a entrada é "Campanhas" (`/marketing/campanhas`) | `app/(dashboard)/disparo/page.tsx`, grep `href="/disparo"` = 0 |
| NENHUM agendador no projeto: sem `vercel.json` (Vercel Cron), sem `pg_cron` em migration. Único processo periódico = worker Python na VPS (poll 5s) | `vercel.json` inexistente, grep `pg_cron` = 0 |
| Chatbot: fluxo sequencial fixo + "não entendi" + fallback que encaminha ao vendedor. IA (Gemini) responde com persona genérica e **zero base de conhecimento** (só histórico de 10 msgs) | `lib/chatbot/engine.ts`, `lib/ai-assistant.ts` |
| Gerador de PDF de proposta já pronto: `pdf-lib` + template `public/templates/proposta_template.pdf` (RECIEE) | `app/api/reciee/clientes/[clienteId]/proposta/route.ts` |
| Instagram: nada além de cor de gráfico/opção de origem de lead. Zero publicação | grep `instagram` |
| Testes hoje: 105 casos vitest + 12 unittest worker (verdes), `tsc --noEmit` limpo | `npm test`, `python3 -m unittest test_disparo_worker` |

---

## Decisões já tomadas (não reabrir)

| # | Decisão | Origem |
|---|---|---|
| **D1** | Janela de "sem resposta" = **24 horas** (vale pro C1 e pro remarketing do M1) | resposta do João, 26/09 |
| **D2** | Agendador único = **worker Python da VPS** (`pg_cron` só como apoio opcional de query barata; Vercel Cron não usar: timeout curto + limite de jobs no Hobby). Worker vira `disparo + remarketing + alertas + agendamento`. | resposta do João ("o que você achar melhor") + análise |
| **D3** | **Disparo fica no MARKETING**, com item próprio na sidebar; remarketing é feito **dentro** do Disparo. CRM só expõe quem precisa responder. | pedido explícito do João |
| **D4** | Fila AXS = **cadastrar a proposta no CRM → ela ser criada na AXS**. Não é "acompanhar o que alguém já fez lá fora". | resposta 1 do João |
| **D5** | Pós-vendas **congelado** nesta leva. | pedido explícito |
| **D6** | M3 (artes com IA) **adiado, mas mapeado** (custo na tabela do M3). M4 Instagram: **só estudo de possibilidade** por enquanto. | respostas 3 e 4 |

---

## F0 — Fundação transversal (fazer ANTES de qualquer item)

Sem isso, C2, M1 e M4 ficam no ar.

### F0.1 — Consertar a esteira de notificações
- Migration: ajustar o CHECK de `notificacoes.tipo` (acrescentar `chatbot`, `meta_atingida`, `kanban_parado`, `conversa_sem_resposta`, `fila_proposta_axs` — ou trocar por catálogo livre comentado).
- Corrigir os inserts que não mandam `user_id` (NOT NULL): `lib/chatbot/engine.ts:674`, `app/api/chatbot/route.ts:86`.
- **TDD:** teste de integração que insere 1 notificação e lê de volta (hoje falharia) + teste de tipo inválido.
- **Pronto quando:** sino mostrar ≥1 notificação real criada por teste.

### F0.2 — Ativar o agendador (decisão D2)
- Criar/estender rotina de despacho no worker Python (`worker/`): varredura diária que aciona remarketing, alerta de kanban e agendamentos.
- Configuração por tabela (o que rodar, quando, último run) para não editar código a cada nova rotina.
- **TDD:** `python3 -m unittest test_disparo_worker` — novos casos, sem rede.
- **Pronto quando:** rodar 1x em modo dry-run e imprimir exatamente o que seria enviado.

### F0.3 — Disparo na navegação do Marketing (decisão D3)
- Definir o canônico (pergunta 6, ainda aberta) e eliminar a duplicidade entre `/disparo` (BulkSender) e `/marketing/campanhas`.

---

## BLOCO CRM

### C1 — Conversas sem resposta em 24h ("cliente foi o último a responder")
- **Objetivo:** na lista de atendimento, o vendedor enxerga quem ficou esperando resposta, e o Marketing consome a mesma fatia.
- **Regra (D1):** `ultima_mensagem_remetente = 'cliente'` **E** `ultima_mensagem_data < now() - 24h` **E** `status IN ('aberto','em_andamento')`.
- **Decisão técnica (troca a pergunta antiga):** resposta automática (chatbot/IA) **conta como resposta nossa** — se o sistema respondeu, a conversa não está "sem resposta"; assim o remarketing não cai em cima de cliente que acabou de receber resposta. Se um dia quiser separar, é 1 linha de query (o campo `remetente` já distingue `vendedor`/`chatbot`).
- **Escopo:**
  1. Índice em `(ultima_mensagem_remetente, ultima_mensagem_data)`.
  2. UI: filtro/aba "⏳ Sem resposta (24h)" + contagem no topo da lista + badge por linha (ex.: "25h").
  3. **Consulta única e exportável** — o remarketing do M1 consuta essa mesma regra (nada de lógica duplicada).
  4. Opcional/depois: badge informativo antes das 24h ("há 1h", "há 4h"), sem disparar alerta.
- **Teste:** 4 conversas fixturadas (cliente há 25h ✅, cliente há 2h ❌, vendedor há 25h ❌, chatbot há 25h ❌) → só a primeira entra.

### C2 — Alerta de kanban parado
- **Objetivo:** vendedor/gestor avisado quando oportunidade fica X dias sem mudança de etapa.
- **Base já existente:** `oportunidades.updated_at` + `preferencias_notificacoes.notif_oportunidades`.
- **Escopo:**
  1. Parâmetros: dias por etapa (padrão + exceções, ex.: `contrato_enviado` alerta em 3 dias) — tabela ou config simples.
  2. Produtor: rotina do worker (F0.2), 1x/dia → grava `notificacoes` com `tipo='kanban_parado'` para o `vendedor_id` (e opcional gestores).
  3. UI: sino (já existe) + pino/badge na coluna do kanban com nº de paradas.
  4. Anti-spam: 1 alerta por oportunidade por episódio de parada; some quando a etapa muda.
- **Não confundir com** `oportunidade_alertas` (é de detecção de conta) — o alerta novo é `notificacoes`.
- **Pré-requisito:** F0.1 (senão o insert morre no CHECK/NOT NULL de novo).
- **A decidir na implementação:** dias padrão, se gestor também recebe, e se some ao mover de etapa.

### C3 — Fila: cadastrar proposta no CRM → criar na AXS (decisão D4)
- **Objetivo:** a proposta nasce preenchida dentro do CRM e a criação na AXS acontece pela ferramenta — com fila, estado e plano B se a automação falhar.
- **Fluxo desenhado:**
  1. Vendedor preenche a proposta GD **no CRM** (formulário: dados do cliente + dados da proposta).
  2. Grava em **`fila_propostas_axs`**: `oportunidade_id`, `cliente_id`, `payload JSONB`, `status ('pendente' → 'enviando' → 'criada' | 'erro' | 'manual')`, `tentativas`, `erro`, `axs_card_id`, timestamps.
  3. Processador (worker F0.2) chama o endpoint **já existente** `POST /api/axs/send` → VPS `2.25.192.248:8080/axs-api` (Playwright), com retry e estado visível.
  4. Confirmação pelo espelho: `/api/axs/sync` preenche `axs_propostas` (`axs_card_id`/`axs_status`) → fila marcada `criada`.
  5. **Tela da fila** (no CRM ou na pasta do cliente): pendentes / enviando / erro, com botões "tentar de novo" e "marcar como feita manualmente".
  6. Retroalimentação do funil: proposta criada → oportunidade avança para `proposta_feita` (automático ou botão — a decidir).
- **Ponto de atenção:** automação com Playwright é frágil por natureza (mudança na AXS quebra). Por isso `status='erro'` + caminho manual são obrigatórios, não opcionais.
- **Teste:** fila com payload fake → processador chama stub HTTP (sem rede), transiciona estado, erro incrementa `tentativas` e preenche `erro`.

### C4 — Proposta finalizada gera documento (padrão RECIEE) — **por último (seu pedido)**
- **Objetivo:** oportunidade fechada gera PDF de proposta como o RECIEE gera.
- **Escopo:** gatilho na etapa (provável `contrato_enviado`) → PDF com `pdf-lib` (mesma base: `app/api/reciee/.../proposta/route.ts`) com dados do cliente + oportunidade → salva no Storage → botão "Baixar proposta" na pasta do cliente e no modal da oportunidade.
- **Depende de:** modelo de dados da proposta GD (campos, valores, validade) — hoje não existe "proposta" como entidade, só a oportunidade — e de C3 existir (é lá que a proposta vira objeto concreto).
- **A decidir na implementação:** conteúdo obrigatório do PDF; gatilho automático ou botão manual.

---

## BLOCO MARKETING

### M1 — Disparo canônico + remarketing (D3, janela D1)
- **Objetivo:** um lugar só no Marketing onde se faz disparo comum **e** remarketing automático.
- **⚠️ Duas bases diferentes — não confundir (foi o principal ajuste do plano):**
  | Onde | Regra |
  |---|---|
  | **Fila de resposta (C1 — fica no CRM)** | **cliente** falou por último e nós há 24h não respondemos |
  | **Público de remarketing (M1 — fica no marketing)** | **nós** falamos por último e o cliente não respondeu em 24h (`ultima_mensagem_remetente != 'cliente'` E `ultima_mensagem_data < now()-24h` E status aberto/em_andamento) |
- **Estado atual:** `/disparo` (BulkSender: fluxo de passos, imagem, variáveis) órfão sem link; `/marketing/campanhas` tem os disparos; `worker/disparo_worker_waha.py` já sabe enviar `sendText`/`sendImage` por passos com delays, `{{nome}}`/`{{telefone}}`, retomada por offset, contadores e log.
- **Escopo:**
  1. Item **"Disparo"** na sidebar de Marketing (D3) levando ao canônico (F0.3).
  2. No cria-da-campanha, origem = **"Remarketing — sem resposta em 24h"** → consulta a base, mostra o **preview do público** antes de rodar.
  3. `bulk_campaigns` ganha `tipo ('avulso' | 'remarketing')` + regra usada (auditoria) + recorte de data.
  4. Gatilho diário no worker (F0.2): monta e roda a campanha de remarketing com mensagem pré-definida (template editável).
  5. **Guardas:** opt-out (o chatbot já tem `ehPedidoDeParada`), não enviar se houve resposta nas últimas X h, não remarcar em menos de Y dias, cadência conservadora e teto diário (risco real: número banido).
  6. **Métrica:** taxa de resposta pós-remarketing (`disparo_logs` + resposta em `atendimento_mensagens`).
- **Depende de:** C1 (consulta compartilhada), F0.2, F0.3.
- **Risco real:** banimento de número por volume — começar com lote pequeno.

### M2 — Chatbot "trata qualquer assunto?"
- **Estado atual (verdade crua):** **não trata.** Hoje: fluxo fixo de qualificação (14 passos GD) → "não consegui entender" → fallback encaminha pro vendedor. A IA (Gemini) responde como "atendente virtual" usando só as últimas 10 mensagens — **não conhece preço, plano, área de atendimento nem nada da empresa** (o prompt proíbe inventar, mas não tem nada pra consultar).
- **Escopo:**
  1. **Base de conhecimento editável** no painel (produtos, preços, prazos, área, horário, política) → injetada no prompt de `lib/ai-assistant.ts` (custo ~0, mesma chave Gemini).
  2. **Guardrails:** assunto fora da base → encaminha pro vendedor (`mensagemFallback` já existe), com registro do motivo.
  3. **Ordem centralizada:** chatbot (qualificação) > IA (tira-dúvidas) > humano — hoje está espalhada no webhook.
  4. **Bateria de conversas-teste:** perguntas reais de cliente com resposta esperada → "trata qualquer assunto" vira teste, não achismo.
- **A decidir antes da Fase 4 (pergunta 7):** o que entra em "qualquer assunto" — só tirar dúvida, ou também puxar assunto/vender?

### M3 — IA criando artes — **adiado, mapeado (D6)**
- **Objetivo de produto:** vendedor preenche 2-3 campos (produto, preço, frase), escolhe template e gera — sem tocar em IA.
- **Escopo quando liberar:** templates (promoção, destaque de produto, saudação, evento) → geração → revisão humana (IA erra texto em arte) → galeria no Storage → saída direta pro Disparo/WhatsApp.
- **Mapeamento de custo (consulta em 26/09/2026, USD; fontes: página de preços da Gemini API e comparativos de mercado):**
  | Opção | Custo aprox./imagem 1024px | Observação |
  |---|---|---|
  | `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) | ~US$ 0,034 | mais barata da família Gemini |
  | `gemini-3.1-flash-image` (Nano Banana 2) | ~US$ 0,067 | melhor custo/benefício de qualidade |
  | `gemini-3.1-pro-image` (Nano Banana Pro) | ~US$ 0,134 | melhor fidelidade de texto/logo |
  | GPT Image 2.5 (OpenAI), qualidade média | ~US$ 0,013 | saída em tokens, varia com tamanho/qualidade |
  | ⚠️ `gemini-2.5-flash-image` | — | **descontinuado, desligamento 02/10/2026 — não usar** |
  | ⚠️ Imagen (Google) | — | descontinuado desde 17/08/2026 |
- **Tradução:** centavos de dólar a ~R$ 0,75 por arte (1K). Volume real decide o mensal.
- **Quando voltar, decidir:** provedor, teto mensal de gasto, e se precisa de logo/marca d'água automática (a saída do Gemini já carrega marca SynthID).

### M4 — Programação de artes para Instagram e WhatsApp — **estudo (D6)**
- **WhatsApp: viável já.** Agendar + enviar imagem pelo WAHA → mesma esteira do worker (F0.2). Só falta UI de calendário.
- **Instagram — o que a API oficial exige (docs Meta, consultados em 26/09/2026):**
  1. Conta Instagram **profissional (Business ou Creator)** vinculada a uma **Página no Facebook**.
  2. **Conta de desenvolvedor Meta + app** (tipo Business) com o produto *Instagram Graph API*.
  3. Permissões `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (+ `ads_management`/`ads_read` se houver papel no Business Manager). Em produção exige **App Review** da Meta (vídeo do fluxo + descrição de uso).
  4. Fluxo de publicação: `POST /{ig}/media` (container, `image_url` **público**) → `POST /{ig}/media_publish`.
  5. **Agendamento nativo:** `published=false` + `scheduled_publish_time` (entre 10 min e 75 dias).
  6. **Limites:** ~50–100 posts por 24h por conta (a própria doc Meta diverge entre seções); carrossel conta como 1 post; o container expira em 24h.
  7. Token de longa duração precisa de renovação periódica → mais uma rotina no worker.
  8. Arte gerada por IA: parâmetro `is_ai_generated=true` na publicação.
  9. Página com *Page Publishing Authorization* (PPA) ou 2FA exigida bloqueiam a publicação se não forem concluídas.
- **Conclusão do estudo:** **é possível**, sem custo de infra (conta/app/review gratuitos) — o custo é humano (criar app, passar no review, manter token). **Sem conta Business na Meta, nasce bloqueado.**
- **Fases:** (a) calendário no Marketing + geração da arte; (b) envio agendado WhatsApp; (c) conta Meta + app + review → publicação automática. Enquanto (c) não existir, o sistema gera e deixa a arte pronta para postagem manual.

---

## PÓS-VENDAS
Congelado por decisão (D5). Nada de código nesse bloco nesta leva.

---

## Ordem de execução

| Fase | Itens | Por quê |
|---|---|---|
| **0** | F0.1 notificações → F0.2 agendador → F0.3 Disparo na navegação | infra compartilhada; sem ela C2/M1/M4 não andam |
| **1** | C1 sem resposta (24h) → C2 kanban parado | C1 entrega rápido e vira base do M1 |
| **2** | M1 Disparo + remarketing | maior ganho; usa C1 + agendador |
| **3** | C3 fila AXS | desenho fechado (D4); é a maior peça |
| **4** | M2 chatbot com base de conhecimento | corre paralelo ao 3 |
| **5** | M3 (se liberado) + M4 WhatsApp agendado / Instagram em estudo | depende de custo (M3) e conta Meta (M4) |
| **6** | C4 documento de proposta | você colocou por último |

## Perguntas — situação

| # | Pergunta | Status |
|---|---|---|
| 1 | AXS: criar ou só acompanhar? | ✅ **D4** — cadastrar no CRM e criar na AXS |
| 2 | Janela do C1 / resposta de bot conta? | ✅ **D1** (24h) + decisão técnica (resposta automática conta) |
| 3 | Custo de geração de imagem | ⏸️ adiado, **mapeado na tabela do M3** |
| 4 | Conta Business no Instagram | ⏸️ estudo feito, **mapeado no M4** (bloqueia só a fase c) |
| 5 | Agendador único | ✅ **D2** — worker da VPS |
| 6 | Disparo canônico: BulkSender ou Campanhas? | ❓ aberta — resolve na Fase 0 (F0.3) |
| 7 | O que é "qualquer assunto" no chatbot? | ❓ aberta — resolve antes da Fase 4 |

## Precedentes técnicos já decididos (não refazer)
- Worker Python só-stdlib, poll no Supabase, envio via WAHA; testes `python3 -m unittest test_disparo_worker`.
- Bateria E2E de atendimento **só envia para 6282735286** (556282735286) — nunca trocar o destino.
- WhatsApp: sessões `STK-1/2/3` (+ `ROMA_1`) todas WORKING; webhook único `/api/webhooks/waha`.
- PDF: `pdf-lib` (mesma base do RECIEE), template em `public/templates/`.
- Deploy: push em `master` → Vercel build automático; migrations numeradas em `supabase/migrations/` (próxima: **087**).
- Gate de qualquer fase: `npm test` (105 casos) verde + `tsc --noEmit` limpo.
