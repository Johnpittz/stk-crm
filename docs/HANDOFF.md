# HANDOFF — STK-CRM (documento divisor)

> **Este é o ponto de entrada obrigatório.** Toda sessão de trabalho no STK-CRM começa lendo este arquivo.
> Ele existe para que a próxima IA comece a implementar **sem** precisar releer o projeto inteiro nem depender
> da memória de conversas anteriores. Se este doc e o código divergirem, **vale o código** — e você corrige este doc.

**Última atualização:** 26/09/2026 (Fase 0 — código concluído)
**Fase atual:** **Fase 0 concluída no código.** Faltam 3 pendências externas (migrations no SQL Editor, push/deploy, pergunta 6) antes do GO da Fase 1.

---

## 1. Em que situação o projeto está

- Sistema no ar em produção (Vercel + Supabase + WAHA na VPS), 4 números conectados (`STK-1/2/3`, `ROMA_1`), webhook único `/api/webhooks/waha`.
- Migração Evolution → WAHA **concluída**; defeitos pós-cutover corrigidos (`docs/plano-migracao-waha.md` §6 tem as causas-raiz — ler só se mexer em webhook/mídia/LID).
- Testes verdes na última sessão: **112 casos vitest + 29 unittest do worker**, `tsc --noEmit` limpo.
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

**Fechar a Fase 0**, nesta ordem (o código já está pronto e verificado):
1. ~~**F0.1** — notificações~~ ✅ `lib/notificacoes.ts` + 7 testes; os 3 inserts quebrados trocados pelo helper; `supabase/migrations/087_notificacoes_tipos.sql` **pronta, não aplicada**.
2. ~~**F0.2** — agendador** ✅ `worker/agendador.py` + 15 testes; `loop_agendador` ligado no worker (poll 60s); `supabase/migrations/088_worker_rotinas.sql` **pronta, não aplicada**; dry-run ao vivo: 8 conversas >24h · 3 oportunidades paradas >72h.
3. **F0.3** — item "Disparo" na sidebar de Marketing → **travado na pergunta 6** (tela canônica: `/disparo` BulkSender ou `/marketing/campanhas`) → perguntar ao João.

**Pendências externas:** (a) aplicar `087` + `088` no SQL Editor do Supabase; (b) `git push` (dispara deploy Vercel — não subir `worker/__pycache__/*.pyc`); (c) resposta da pergunta 6.

Depois: Fase 1 (C1 sem resposta 24h → C2 alerta de kanban parado).

## 4. Protocolo de checkpoint (como o doc se mantém vivo)

- **Ao terminar cada fase/etapa crucial, ANTES de encerrar a sessão:** atualizar este arquivo — seção 1 (estado), seção 3 (próxima ação) e anexar uma linha na seção 7 (registro). Se o plano mudou, atualizar `docs/plano-acao-modulos.md` também.
- **Ao receber nova decisão do João:** gravar como `D<n>` no plano, não deixar só no chat.
- **Nada de conhecimento importante só no chat** — se uma descoberta de código não entrar em doc, ela se perde na próxima sessão.

## 5. Comandos essenciais

```bash
cd /root/stk-crm

# Suíte de testes (112 casos, sem rede) — OBRIGATÓRIO antes de dizer "pronto"
npm test

# Type check
npx tsc --noEmit

# Testes do worker (29 casos, sem rede: disparo + agendador)
cd worker && python3 -m unittest && cd ..

# Rodar o worker de disparo (só quando for testar de verdade)
set -a && . /root/.stk-worker.env && set +a && python3 worker/disparo_worker_waha.py

# Status das sessões WAHA (de dentro do container — URL interna, hairpin NAT)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)
curl -s -H "X-Api-Key: $K" http://172.16.1.1:3000/api/sessions
```

- Env do worker/banco: `/root/.stk-worker.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WAHA_API_URL=http://172.16.1.1:3000`).
- Migrations: `supabase/migrations/` — **087 e 088 escritas, faltam aplicar** no SQL Editor (a `scripts/aplicar-migracao.js` NÃO serve: ela chama a RPC `exec_sql`, que não existe neste projeto).
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
| 26/09/2026 | Fase 0 (código) | F0.1 notificações (helper + 7 testes + migração 087) e F0.2 agendador (worker + 15 testes + migração 088), com TDD; causa-raiz do sino mudo encontrada (3 inserts inválidos + `scripts/limpar-atendimentos-teste.sql:40`); bug `+00:00` na query string corrigido e testado; dry-run ao vivo do agendador | ⚠️ código pronto; faltam migrations, push e pergunta 6 |

## 8. Frase de início para a próxima conversa (para o humano)

> **"Leia `/root/stk-crm/docs/HANDOFF.md`, confirme a fase atual e comece a Fase X."**

Variantes úteis:
- Só para revisar: *"Leia o HANDOFF do STK-CRM e me diga em que ponto estamos."*
- Para pular etapa: *"Leia o HANDOFF, pule a Fase 0 e ataque a Fase 1."*
- Para nova ideia: *"Leia o HANDOFF e o plano de ação; quero adicionar o item Z — onde ele entra?"*
