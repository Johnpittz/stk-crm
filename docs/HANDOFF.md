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
- Testes verdes na última sessão: **134 casos vitest + 45 unittest do worker**, `tsc --noEmit` limpo e `next build` ok.
- **Fase 1 no ar:** C1 (filtro "Sem resposta 24h" + badge por linha, régua única `lib/atendimentos/sem-resposta.ts`) e C2 (badge de coluna + produtor de alerta `kanban_parado` com anti-spam no agendador). Worker publicado em `/app/stk-worker` e reiniciado — leitura real em produção: **8 conversas >24h sem resposta, 3 oportunidades paradas >72h**.
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
   badge âmbar `24h+` na linha da conversa. 8 casos/fixtures (`lib/atendimentos/sem-resposta.test.ts`).
2. ✅ **C2 — alerta de kanban parado**: régua `lib/oportunidades/parada.ts` (72h padrão,
   `por_etapa` sobrepõe) usada no badge âmbar da coluna do funil — o badge lê o `config` da própria
   rotina em `worker_rotinas`, então muda sem deploy. Produtor: `handler_oportunidades_paradas`
   em `worker/disparo_worker_waha.py` grava `notificacoes` tipo `kanban_parado` (liberado pela 087)
   em **lote único** (1 linha por parada × perfil vendedor/admin) com **anti-spam**: só reavisa
   depois que a oportunidade mudar de etapa. 16 testes (`worker/test_rotinas_fase1.py`).
3. 🛡️ **Corte de segurança próprio do C2**: só envia quando a rotina está com
   `config.dry_run = false`; **padrão = ligado (mudo)**. C1 não envia nada — só filtra/conta.

**Pendências da Fase 1 (2 itens, só do lado humano):**
- aplicar **`supabase/migrations/089_indices_fase1.sql`** no SQL Editor (só índices — sem ela o
  sistema funciona normalmente, só conta/pesquisa mais devagar);
- quando quiser o alerta de verdade no sino:
  `UPDATE worker_rotinas SET config = config || '{"dry_run": false}' WHERE nome = 'preparacao_alerta_kanban';`
  (ele já foi testado a frio contra produção em modo leitura: 3 oportunidades hoje.)

**Próxima fase: Fase 2 — M1 (Disparo canônico + remarketing)**, que bebe da régua do C1
(`lib/atendimentos/sem-resposta.ts`) e do agendador (uma rotina nova em `worker_rotinas` +
handler com o MESMO corte `dry_run` por config). Depois: Fase 3 — C3 fila AXS.

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

# Suíte de testes (134 casos, sem rede) — OBRIGATÓRIO antes de dizer "pronto"
npm test

# Type check
npx tsc --noEmit

# Testes do worker (45 casos, sem rede: disparo + agendador + rotinas da Fase 1)
cd worker && python3 -m unittest && cd ..

# Rodar o worker de disparo (só quando for testar de verdade)
set -a && . /root/.stk-worker.env && set +a && python3 worker/disparo_worker_waha.py

# Status das sessões WAHA (de dentro do container — URL interna, hairpin NAT)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)
curl -s -H "X-Api-Key: $K" http://172.16.1.1:3000/api/sessions
```

- Env do worker/banco: `/root/.stk-worker.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WAHA_API_URL=http://172.16.1.1:3000`).
- Migrations: `supabase/migrations/` — **087 e 088 aplicadas; 089 escrita, falta aplicar** no SQL Editor (a `scripts/aplicar-migracao.js` NÃO serve: ela chama a RPC `exec_sql`, que não existe neste projeto; não há `psql`/token de gestão aqui dentro — aplicação é manual, no painel do Supabase).
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
| 26/09/2026 | Fase 1 (C1 + C2) | TDD de ponta a ponta: 22 testes novos (8 em `lib/atendimentos/sem-resposta.test.ts`, 6 em `lib/oportunidades/parada.test.ts`, 2 no `lib/notificacoes.test.ts`, 16 em `worker/test_rotinas_fase1.py`) — RED confirmado antes do código. C1: régua única exportável + filtro "Sem resposta" + badge por linha. C2: régua por etapa + badge de coluna + produtor de alerta com anti-spam e corte próprio (`config.dry_run`). migration **089 escrita** (índices); `next build` ok; worker publicado em `/app/stk-worker` (sha idêntico ao repo) e reiniciado; dry-run de leitura em produção: 8 conversas >24h, 3 paradas >72h | ✅ **Fase 1 ENCERRADA — falta aplicar 089 no SQL Editor** |

## 8. Frase de início para a próxima conversa (para o humano)

> **"Leia `/root/stk-crm/docs/HANDOFF.md`, confirme a fase atual e comece a Fase X."**

Variantes úteis:
- Só para revisar: *"Leia o HANDOFF do STK-CRM e me diga em que ponto estamos."*
- Para pular etapa: *"Leia o HANDOFF, pule a Fase 0 e ataque a Fase 1."*
- Para nova ideia: *"Leia o HANDOFF e o plano de ação; quero adicionar o item Z — onde ele entra?"*
