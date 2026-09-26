# HANDOFF — STK-CRM (documento divisor)

> **Este é o ponto de entrada obrigatório.** Toda sessão de trabalho no STK-CRM começa lendo este arquivo.
> Ele existe para que a próxima IA comece a implementar **sem** precisar releer o projeto inteiro nem depender
> da memória de conversas anteriores. Se este doc e o código divergirem, **vale o código** — e você corrige este doc.

**Última atualização:** 26/09/2026 — **FASE 1 ENCERRADA (C1 + C2 no ar; falta a migration 089 no SQL Editor)**
**Fase atual:** **Fase 1 concluída**. Próxima: **Fase 2 — M1 (Disparo + remarketing)**.
Pendências da Fase 1 (só do lado humano): aplicar `supabase/migrations/089_indices_fase1.sql` e, quando quiser o alerta real no sino, ligar `config.dry_run = false` da rotina `preparacao_alerta_kanban`.

---

## 1. Em que situação o projeto está

- Sistema no ar em produção (Vercel + Supabase + WAHA na VPS), 4 números conectados (`STK-1/2/3`, `ROMA_1`), webhook único `/api/webhooks/waha`.
- Migração Evolution → WAHA **concluída**; defeitos pós-cutover corrigidos (`docs/plano-migracao-waha.md` §6 tem as causas-raiz — ler só se mexer em webhook/mídia/LID).
- Testes verdes na última sessão: **162 casos vitest + 59 unittest do worker**, `tsc --noEmit` limpo.
- `next build` local: **compila, linta e tipa tudo**, mas o prerender falha nas 47 páginas porque `.env.production` está com os valores virados para `[SENSITIVE]` (sem `NEXT_PUBLIC_SUPABASE_URL` real) — é pré-existente e não afeta o deploy: a **Vercel constrói com o env dela e o build do commit `609660a` passou**.
- **Fase 1 no ar:** C1 (filtro "Sem resposta" + badge com as horas reais, régua única `lib/atendimentos/sem-resposta.ts`) e C2 (badge de coluna lendo a config do worker + produtor de alerta `kanban_parado` com anti-spam, indo para o **dono da oportunidade + gestores**, no agendador). Worker publicado em `/app/stk-worker` e reiniciado — leitura real em produção: **8 conversas >24h sem resposta, 3 oportunidades paradas >72h**.
- **Fase 2 (M1) codificada e publicada:** aba "Remarketing" com preview, auditoria `tipo`/`regra`,
  rotina diária `remarketing_diario` com 5 guardas e métrica de taxa de resposta. **Migration 090
  já aplicada em produção** (verificado: coluna `tipo`, tabela `remarketing_opt_out`, rotina ativa
  com `dry_run: true` e template escrito) — ou seja, **está no modo ensaio, não envia nada**; a 089
  (índices) não dá para conferir de fora (rodar de novo é seguro, é `IF NOT EXISTS`).
- **Performance 26/09:** lentidão relatada em todas as abas → mapeada (medição externa + navegador
  logado com sessão temporária, já apagada). Maior causa do Marketing corrigida (lista de campanhas:
  28,6 MB/10 s → 142 KB/0,43 s). No CRM restam 5 correções propostas (a)–(e) — a maior é a
  **chamada duplicada de `page-data`** no Atendimento. **Ver seção 8.**
- Plano das próximas features aprovado e detalhado em **`docs/plano-acao-modulos.md`** (CRM + Marketing, com decisões D1–D6 fechadas).
- Pós-vendas: **congelado** (decisão do dono do projeto).

## 2. Onde ler — hierarquia de leitura

1. **`docs/HANDOFF.md`** (este) — estado, regras, próxima ação.
2. **`docs/plano-acao-modulos.md`** — o escopo aprovado, decisões e ordem das fases. É a especificação da leva atual.
3. **Doc específico do assunto** só quando o assunto exigir:
   - webhook/mídia/dedup/LID → `docs/plano-migracao-waha.md`
   - conectar número/WAHA → `docs/runbook-conectar-numeros-stk.md`
   - funil/oportunidades → `ESTRUTURA_DE_FUNIL_DE_VENDAS.md`, `INTEGRACAO_ATENDIMENTO_KANBAN.md`
   - disparo/campanhas → `worker/README.md`
4. **Código** — fonte da verdade. Docs antigos (`README.md`, `ARQUITETURA.md`, `PROGRESSO.md`, `PROGRESSO.MD`) estão **desatualizados** (ainda falam "CRM ROMA", dados mock, Evolution como canal ativo) — não usar como referência de estado.

## 3. Próxima ação (de onde parar)

~~**Fechar a Fase 0**~~ — **CONCLUÍDA em 26/09** (migrations aplicadas, push feito, F0.3 no ar,
worker publicado). Abaixo fica o histórico do que foi feito:
1. ✅ **F0.1 — notificações**: `lib/notificacoes.ts` + 7 testes; os 3 inserts quebrados trocados
   pelo helper; migração `087` **aplicada** e **smoke OK** (insert `tipo='chatbot'` entrou, foi lido
   de volta e apagado — tabela em 0 linhas).
2. ✅ **F0.2 — agendador**: `worker/agendador.py` + 15 testes; `loop_agendador` no worker (poll 60s);
   migração `088` **aplicada** (2 rotinas semeadas); ciclo real gravou `ultima_execucao` e
   `proxima_execucao = +24h`; contagens atuais: **8 conversas >24h · 3 oportunidades paradas >72h**.
3. ✅ **F0.3 — Disparo no menu de Marketing** → `/disparo` (BulkSender, tela canônica escolhida pelo João).

**Deploy:** 4 commits no `master` (`c7b367e`…`5afbf47`), deploy **Vercel stk-crm-amber = success**,
produção de pé (`/api/health`=200, webhook=401). Worker publicado em `/app/stk-worker/` e **no ar**
(log: `agendador: poll=60.0s dry_run=True`). ⚠️ Projeto `stk-crm-edit` falha no build **desde antes**
desta leva — é problema pré-existente, não é desta sessão.

~~Fase 1~~ — **CONCLUÍDA em 26/09** (C1 e C2 codificados, testados, publicados e no ar).
Histórico:
1. ✅ **C1 — conversas sem resposta (24h)**: régua **única** em `lib/atendimentos/sem-resposta.ts`
   (função pura + builder de query exportável — o remarketing do M1 consome a MESMA regra, sem
   duplicar lógica); na tela de atendimento: filtro "Sem resposta (n)" ao lado de "Todas (n)" e
   badge âmbar com as horas **reais** de espera na linha da conversa (ex.: `25h`) e contagem no
   topo. Resposta automática (chatbot/IA) conta como resposta nossa. 14 casos/fixtures
   (`lib/atendimentos/sem-resposta.test.ts`).
2. ✅ **C2 — alerta de kanban parado**: régua `lib/oportunidades/parada.ts` (72h padrão,
   `por_etapa` sobrepõe) usada no badge âmbar da coluna do funil — o badge lê o `config` da própria
   rotina em `worker_rotinas`, então muda sem deploy. Produtor: `handler_oportunidades_paradas`
   em `worker/disparo_worker_waha.py` grava `notificacoes` tipo `kanban_parado` (liberado pela 087)
   em **lote único** (1 linha por parada × destinatário: o **dono da oportunidade + gestores**;
   sem dono válido, só os gestores) com **anti-spam**: só reavisa depois que a oportunidade mudar
   de etapa. 17 testes (`worker/test_rotinas_fase1.py`).
3. 🛡️ **Corte de segurança próprio do C2**: só envia quando a rotina está com
   `config.dry_run = false`; **padrão = ligado (mudo)**. C1 não envia nada — só filtra/conta.

**Pendências da Fase 1 (2 itens, só do lado humano):**
- aplicar **`supabase/migrations/089_indices_fase1.sql`** no SQL Editor (só índices — sem ela o
  sistema funciona normalmente, só conta/pesquisa mais devagar);
- quando quiser o alerta de verdade no sino:
  `UPDATE worker_rotinas SET config = config || '{"dry_run": false}' WHERE nome = 'preparacao_alerta_kanban';`
  (ele já foi testado a frio contra produção em modo leitura: 3 oportunidades hoje.)

~~Fase 2 (M1 — Disparo canônico + remarketing)~~ — **CODIFICADA e TESTADA em 26/09**.
O que já está pronto:
1. ✅ **Regra única do público** (`lib/marketing/remarketing.ts`): NÓS falamos por último e o cliente
   não respondeu em 24h — é o INVERSO do C1 de propósito (não confundir: C1 = fila de quem nos
   deve resposta; M1 = quem não nos respondeu). Espelho em Python no worker; 17 testes.
2. ✅ **Origem "Remarketing" na tela de disparo** (3ª aba): o servidor calcula o público e a tela
   mostra o preview (quem entra, quem sai por opt-out/recência, corte de 200) ANTES de criar.
3. ✅ **Auditoria**: `bulk_campaigns.tipo ('avulso'|'remarketing')` + `regra JSONB` (migration 090).
4. ✅ **Gatilho diário**: rotina `remarketing_diario` monta a campanha e grava como `running` —
   o loop de envio existente entrega. Mensagem vem de `config.template` (editável sem deploy).
5. ✅ **Guardas** (cada uma com teste): `dry_run` por config (**padrão LIGADO/mudo**), teto diário 20,
   cadência mínima de 24h entre campanhas, não remarcar o mesmo telefone em 7 dias, opt-out eterno
   (tabela `remarketing_opt_out` — o chatbot grava ali quando o cliente pede para parar).
6. ✅ **Métrica** (M1.6): rota `resultado-remarketing` calcula enviados x respostas e a taxa (%),
   exibida junto dos logs do disparo de remarketing.

**Pendências da Fase 2 (3 itens, só do lado humano):**
- **aplicar `supabase/migrations/090_m1_remarketing.sql` no SQL Editor — OBRIGATÓRIA**: sem ela a
  rotina não existe no banco e a própria rotina recusa rodar (HTTP 400 no histórico = falha fechada,
  nada é enviado). Testada a frio em produção: **15 conversas no público hoje**;
- aplicar também a `089` da Fase 1 (índices);
- só então decidir **LIGAR**: escrever o `template` da rotina `remarketing_diario`, trocar
  `dry_run` para `false` e subir o worker com `AGENDADOR_DRY_RUN=0` no `/app/stk-worker/env`
  (sem isso o agendador não persiste a agenda e a rotina reexecutaria a cada poll).

**Próxima fase (depois dessas pendências): Fase 3 — C3, fila "cadastrar no CRM → criar na AXS" (D4).**

## 4. Protocolo de checkpoint (como o doc se mantém vivo)

- **Ao terminar cada fase, a sequência é OBRIGATÓRIA e nesta ordem:**
  1. atualizar este arquivo — seção 1 (estado), seção 3 (próxima ação) e uma linha na seção 7 (registro);
  2. commitar/pushar (se houver código);
  3. **avisar o João em linguagem simples**, sem jargão de arquivo;
  4. **ENCERRAR a sessão e pedir para ele abrir um chat novo** lendo este arquivo.
     O chat não continua: é assim que o contexto não satura e a próxima IA começa limpa.
     Não propor "continuar a próxima fase aqui" — se ele quiser, ele mesmo pede.
- **Se o plano mudou:** atualizar `docs/plano-acao-modulos.md` também.
- **Ao receber nova decisão do João:** gravar como `D<n>` no plano, não deixar só no chat.
- **Nada de conhecimento importante só no chat** — se uma descoberta de código não entrar em doc, ela se perde na próxima sessão.

## 5. Comandos essenciais

```bash
cd /root/stk-crm

# Suíte de testes (159 casos, sem rede) — OBRIGATÓRIO antes de dizer "pronto"
npm test

# Type check
npx tsc --noEmit

# Testes do worker (59 casos, sem rede: disparo + agendador + rotinas Fase 1 + remarketing Fase 2)
cd worker && python3 -m unittest && cd ..

# Rodar o worker de disparo (só quando for testar de verdade)
set -a && . /root/.stk-worker.env && set +a && python3 worker/disparo_worker_waha.py

# Status das sessões WAHA (de dentro do container — URL interna, hairpin NAT)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)
curl -s -H "X-Api-Key: $K" http://172.16.1.1:3000/api/sessions
```

- Env do worker/banco: `/root/.stk-worker.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WAHA_API_URL=http://172.16.1.1:3000`).
- Migrations: `supabase/migrations/` — **087 e 088 aplicadas; 089 (índices Fase 1) e 090 (M1: `tipo`/`regra`/opt-out/seed da rotina) escritas, falta aplicar as duas** no SQL Editor (a `scripts/aplicar-migracao.js` NÃO serve: ela chama a RPC `exec_sql`, que não existe neste projeto; não há `psql`/token de gestão aqui dentro — aplicação é manual, no painel do Supabase).
- Deploy: `git push origin master` → build automático na Vercel. Confirmar `git remote -v` antes de push.
- code-server: `https://srv1745477.hstgr.cloud:8080/?folder=/root/stk-crm`

## 6. Regras não-negociáveis

1. **TDD** (RED → GREEN → REFACTOR) em qualquer feature nova; testes são gate de "fase concluída".
2. **Bateria E2E (`worker/bateria_waha.py`) só envia para `6282735286`** (`556282735286`). Nunca trocar o destino, nunca rodar por curiosidade — ela mensageia produção.
3. **Não commitar segredo.** O repo é **público** e já contém `.env.production`/`.env.example`/`PROGRESSO.MD` com credenciais (rotação pendente do dono do projeto) — não repetir valores em chat/log e não adicionar mais nenhum.
4. **Rotação de segredos pendente** (fora do escopo desta leva): reportar ao João quando ele tocar no assunto.
5. WhatsApp: **1 webhook** (`/api/webhooks/waha`), sessões `STK-1/2/3` + `ROMA_1`. Não reconectar número sem ordem — troca de canal é evento único orquestrado.
6. **Perfis:** Disparo/Remarketing pertencem ao **MARKETING** (decisão D3). Não mover funcionalidade de disparo para o CRM.
7. Escopo congelado: **Pós-Vendas** (D5). M3/M4 só estudo até decisão nova (D6).
8. Respostas da última rodada de perguntas: janela **24h** (D1), agendador = **worker da VPS** (D2), fila AXS = **cadastrar no CRM → criar na AXS** (D4).

## 7. Registro de sessões (append-only)

| Data | Fase | O que foi feito | Situação |
|---|---|---|---|
| 26/09/2026 | Planejamento | Imersão no codebase (66 rotas, 35 telas, 46 migrations), verificação de estado real, 5 perguntas respondidas, plano aprovado em `docs/plano-acao-modulos.md`, criação deste handoff | ✅ concluída |
| 26/09/2026 | Fase 0 (código) | F0.1 notificações (helper + 7 testes + migração 087) e F0.2 agendador (worker + 15 testes + migração 088), com TDD; causa-raiz do sino mudo encontrada (3 inserts inválidos + `scripts/limpar-atendimentos-teste.sql:40`); bug `+00:00` na query string corrigido e testado; dry-run ao vivo do agendador | ✅ código pronto |
| 26/09/2026 | Fase 0 (deploy) | migrations 087/088 aplicadas + smoke do sino (insert/lê/apaga); 4 commits e push com deploy Vercel **success**; F0.3 sidebar; worker novo publicado em `/app/stk-worker` e no ar com o agendador (ciclo real gravou agenda +24h) | ✅ Fase 0 encerrada |
| 26/09/2026 | Fase 1 (C1 + C2) | TDD de ponta a ponta: **42 testes novos** (14 em `lib/atendimentos/sem-resposta.test.ts`, 10 em `lib/oportunidades/parada.test.ts`, 1 em `lib/notificacoes.test.ts`, 17 em `worker/test_rotinas_fase1.py`) — RED confirmado antes do código. C1: régua única exportável + filtro "Sem resposta" + badge por linha com as horas reais (resposta automática conta como nossa). C2: régua por etapa configurável sem deploy + badge de coluna lendo a config do worker + produtor de alerta com anti-spam, destinatário = **dono + gestores** e corte próprio (`config.dry_run`). migration **089 escrita** (índices, falta aplicar); worker publicado em `/app/stk-worker` (sha idêntico ao repo, processo reiniciado) e leitura real em produção: **8 conversas >24h / 3 paradas >72h** (dry_run: nada enviado); commit `609660a` pushado e **build da Vercel (`stk-crm-amber`) passou** — o projeto `stk-crm-edit` já falhava antes, é outro | ✅ **Fase 1 ENCERRADA — falta aplicar 089 no SQL Editor** |
| 26/09/2026 | Performance (fora das fases) | Mapeamento da lentidão relatada: medido em produção que `GET /api/bulk/campaigns` devolvia 28,6 MB/10 s (imagens em base64 em `fluxo_mensagens`) e que funções paradas custam 1–4 s (tempo frio). Conserto do item 1 aplicado com TDD (3 testes) e publicado (`15216ad`): **142 KB/0,43 s**. Estão saudáveis: banco (28 atendimentos), consultas 0,1–0,5 s, WAHA 95 ms, mídia com cache. Depois entrou em produção com sessão temporária (apagada ao final) para medir a troca de aba no navegador: RSC 84–250 ms, páginas prontas em 0,5–2,0 s, achando a **chamada duplicada de `page-data`** no Atendimento e as 3 de `oportunidades` no Kanban. Detalhes e próximos passos na seção 8. | ✅ Marketing corrigido e CRM medido; correções (a)–(e) da seção 8 a decidir |
| 26/09/2026 | Fase 2 (M1 Disparo + remarketing) | TDD de ponta a ponta: **18 testes novos** (17 em `lib/marketing/remarketing.test.ts`, 5 em `app/api/bulk/resultado-remarketing/route.test.ts`, 13 em `worker/test_remarketing.py` — RED confirmado antes do código). Entregue: regra única do público (inversa do C1), aba "Remarketing" com preview no servidor, auditoria `tipo`+`regra`, rotina diária `remarketing_diario` com 5 guardas (dry_run padrão ligado, teto 20, cadência 24h, não remarcar 7 dias, opt-out eterno gravado pelo chatbot) e métrica de taxa de resposta na tela. Worker publicado em `/app/stk-worker` (sha idêntico) e reiniciado; rotina testada a frio em produção (15 no público; falha fechada HTTP 400 enquanto a 090 não rodar). migrations 089 e 090 escritas | ✅ **código pronto — falta aplicar 090 (+089) e decidir quando LIGAR** |

## 8. Diagnóstico de performance (26/09)

**Sintoma relatado:** lentidão em todas as páginas, pior ao trocar de aba (CRM e Marketing).

**Medido contra produção (antes → depois):**

1. **`GET /api/bulk/campaigns` — causa comprovada da lentidão do Marketing/Disparo**
   - antes: **28.613.000 bytes em 9,9–11,9 s** (3 medições) → depois: **142.442 bytes em 0,43 s**
     (1,1 s só na 1ª chamada, quando a função acorda). Ganho ~25×.
   - causa: `fluxo_mensagens` guarda as imagens dos passos **em base64 no banco** — 28,46 MB das
     28,6 MB, acumulados por 36 das 54 campanhas (uma tem 2,6 MB). A tela já busca essa coluna à
     parte, só quando abre o detalhe.
   - afeta: **Marketing → Campanhas**, **Marketing → Relatórios** e a tela de **Disparo** (que ainda
     refaz a chamada **a cada 5 s** enquanto há disparo rodando).
   - conserto: commit `15216ad` (GET/POST listam as 29 colunas reais menos a pesada + joins) e
     `app/api/bulk/campaigns/route.test.ts` (3 testes: a lista não pode pedir `fluxo_mensagens`).
2. **Tempo frio de função serverless (medido):** `/api/whatsapp/contacts` 1ª chamada **3,87 s** →
   2ª **0,28 s**; `bulk/campaigns` **1,1 s** → **0,43 s**. Cada aba que você abre paga o frio da
   primeira rota que chamar — é o que sobra de "demora em tudo".
3. **Está saudável:** banco pequeno (28 atendimentos, 1.446 mensagens), consultas 0,10–0,50 s, WAHA
   (topo) responde em 95 ms, mídia com cache de 24 h, middleware já otimizado.
4. **Medido no navegador logado (26/09 — sessão temporária criada e já apagada)**, duas passadas:

   | destino | troca da URL | até a página ficar **pronta** | pedidos de API |
   |---|---|---|---|
   | Clientes | 169 ms | **0,54 s** | nenhum |
   | Marketing (dashboard) | 171 ms | **0,54 s** | 3 (~150 ms cada) |
   | Dashboard | 250 ms | **0,70 s** | 1 (`tarefas` 233 ms) |
   | Kanban | 246 ms | **1,60 s** | 5 (`oportunidades` 759/632/328 ms + `atendimentos` 339) |
   | Atendimento | 84–250 ms | **1,77–2,02 s** | 5 (`page-data` **1.655 ms** + `page-data` **1.092 ms** + `whatsapp/contacts` 786 ms) |
   | Disparo (carga) | — | **0,70 s** | `bulk/campaigns` 446 ms / 9 KB |
   | Relatórios (carga) | — | **0,78 s** | `bulk/campaigns` 188 ms / 9 KB |

   Leitura: a **troca em si é rápida** (84–250 ms = RSC + layout); o demorado é **encher a página**.

5. **Duas causas novas confirmadas (CRM):**
   - **Chamadas duplicadas na montagem.** `atendimento/page.tsx` tem DOIS efeitos que disparam
     `fetchPageData()` — a "montagem" e o "abrir/fechar chat"; o segundo **também roda na primeira
     vez**, então **`page-data` sai 2× a cada entrada** (medido: 1.655 ms + 1.092 ms) e, como as duas
     invocações da mesma função se enfileiram, **duplica a espera**. No Kanban são 3 chamadas de
     `oportunidades` (759/632/328 ms) — mesmo padrão.
   - **`whatsapp/contacts` custa ~700–800 ms** toda vez que o Atendimento abre (busca 100 contatos
     no WAHA pelo servidor).
6. **Polling medido:** `page-data` repete **aos 15 s exatos** (t=37,5 s vs t=22,5 s), `tarefas/resumo`
   e performance 60 s, topo 60 s, sino 180 s, disparo 5 s enquanto roda.

**Correções ainda não feitas (reordenadas com os números medidos):**
- **(a) tirar a chamada duplicada** — Atendimento `-1` chamada de `page-data` (~0,8–1,7 s) e Kanban
  `-2` de `oportunidades` (~1 s): é meia linha cada, é o maior ganho imediato do CRM;
- **(b) `whatsapp/contacts` só quando necessário** (ou em background) — tira ~0,7–0,8 s da entrada;
- **(c) mover as imagens do base64 para o Storage** — o banco volta a ~0,15 MB e para de crescer;
- **(d) cache de navegação** (voltar numa aba já vista sem refazer tudo);
- **(e) reduzir os polls** de 5 s/15 s e consolidar os pedidos da tela de Atendimento.

## 9. Frase de início para a próxima conversa (para o humano)

> **"Leia `/root/stk-crm/docs/HANDOFF.md`, confirme a fase atual e comece a Fase 2 (M1 — Disparo + remarketing)."**

Variantes úteis:
- Só para revisar: *"Leia o HANDOFF do STK-CRM e me diga em que ponto estamos."*
- Para pular etapa: *"Leia o HANDOFF, pule a Fase 0 e ataque a Fase 1."*
- Para nova ideia: *"Leia o HANDOFF e o plano de ação; quero adicionar o item Z — onde ele entra?"*
