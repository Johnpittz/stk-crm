# HANDOFF — STK-CRM (documento divisor)

> **Este é o ponto de entrada obrigatório.** Toda sessão de trabalho no STK-CRM começa lendo este arquivo.
> Ele existe para que a próxima IA comece a implementar **sem** precisar releer o projeto inteiro nem depender
> da memória de conversas anteriores. Se este doc e o código divergirem, **vale o código** — e você corrige este doc.

**Última atualização:** 30/09/2026 — **SINCRONIA DE MENSAGENS (relato do João: "o que eu
mando fora do CRM não aparece dentro") — 2 BUGS ACHADOS E CONSERTEADOS**: **S-01** mensagem
`fromMe` era arquivada **na conversa errada** porque o parser lia os campos de REMETENTE
(`senderAlt`/`fromAlt`/`participantAlt`) — numa mensagem nossa o remetente somos nós; o chat
`@lid` era gravado apontando para o **nosso número** e todo o histórico enviado parava no
atendimento do nosso número (10 mensagens de Alan, de 28/09 13:57 a 30/09 16:09). Conserto TDD
(`RecipientAlt` para `fromMe`; sem ele, cai na resolução do LID) em **`4555880`**, provado em
produção por replay (veneno → **400**; `RecipientAlt` → **200** no atendimento certo).
**S-02** vCard/localização viravam conteúdo vazio → rota **400 "Mensagem vazia"** e a mensagem
sumia → agora `[contato]`/`[localização]` (**`66e2d84`**). **Reparo:** 10 mensagens movidas para
o atendimento certo, mapa do LID corrigido (`279885889175741` → `554784227161`), conversa errada
apagada, **7 mensagens repostas** por replay. **Auditoria final por id: Alan 26/26, espelho 9/9,
0 fora do CRM** (sobra 1 de 14/09, pré-migração WAHA). Gates: **305 testes** + `tsc` ✅.
Procedimento completo: seção "Sincronização de mensagens" em `docs/TESTES-SISTEMA.MD`.

**Registro anterior — 28/09/2026 (C01):** o robô criou o card
na AXS pelo caminho oficial (fila → `criar/card` → **`1452248820`**, mensalidade **767,88**,
consumo 1000, 28/09 23:51). **PARECER COMPLETO E NÃO-PERDÍVEL: `docs/PARECER-ARP-28-09-2026.md`**
— resumo: a AXS **não** mudou nada desde domingo; eram **3 causas nossas empilhadas**:
**(1)** payload sem consumo mínimo (1000×12) → `500 Erro ao gerar proposta`;
**(2)** ARP é de **sessão única** → `203 sessao ativa`/`403`, com receita de emergência
`login(203)` → `POST /csp/representante/sessao/derrubar {email, chaveValidadeSessao}` →
`DELETE /csp/representante/sessao/excluir` → `login(200)` (o campo **muda de nome** no envio;
o `derrubar` já devolve token — logar logo depois volta 203);
**(3)** `fila_propostas_axs.payload` é **plano**: o robô manda `item.payload` para
`montar_proposta`, que lê no topo — com `{cliente_id, dados_proposta}` tudo vira `None` e a
ARP responde `ERROR #5034`; **achatou → criou na 1ª tentativa**.
Apagar card: **`POST /csp/representante/excluir/card/`** com `{"idCard": …}` (o `DELETE
/excluir/card/{id}` dá 404). Diagnóstico em ordem no §6 do parecer.

**Também em 27/09 — FASE 6 (C4) CONCLUÍDA:** a oportunidade agora gera o
**documento de proposta em PDF** (botão "Gerar/Baixar proposta" na pasta do cliente e no modal da
oportunidade, mais gatilho automático quando a etapa vira **Contrato Enviado**), gravado no Storage
privado e registrado na tabela `propostas`. Decisões **D8** e **D9** no plano.
**Fase atual:** Fase 0 ✅, Fase 1 ✅, Fase 2 ✅, Fase 3 ✅, Fase 4 ✅, **Fase 6 ✅ (C4)**.
**Próxima fase: NENHUMA — as fases executáveis do plano acabaram** (Fase 5 do plano = M3/M4 é
adiada/estudo por **D6**; Pós-Vendas congelado por **D5**).
Pendência da Fase 6 (só do lado humano): aplicar **`supabase/migrations/093_propostas_documento.sql`**
no SQL Editor — sem ela o botão responde com a mensagem pedindo a migration (tabela `propostas` +
bucket `propostas`).
Continua pendente: migration da Fase 1 (`089`, índices de performance). `AXS_ARP_SENHA` **já
está** no env do worker (verificado por tamanho, 28/09) — não é mais pendência.

---

## 1. Em que situação o projeto está

- Sistema no ar em produção (Vercel + Supabase + WAHA na VPS), 4 números conectados (`STK-1/2/3`, `ROMA_1`), webhook único `/api/webhooks/waha`.
- Migração Evolution → WAHA **concluída**; defeitos pós-cutover corrigidos (`docs/plano-migracao-waha.md` §6 tem as causas-raiz — ler só se mexer em webhook/mídia/LID).
- Testes verdes na última sessão: **297 casos vitest (1 deles pulado sem `GEMINI_API_KEY`) + 138 unittest do worker**, `tsc --noEmit` limpo.
- `next build` local: **compila, linta e tipa tudo**, mas o prerender falha nas 47 páginas porque `.env.production` está com os valores virados para `[SENSITIVE]` (sem `NEXT_PUBLIC_SUPABASE_URL` real) — é pré-existente e não afeta o deploy: a **Vercel constrói com o env dela e o build do commit `609660a` passou**.
- **Fase 1 no ar:** C1 (filtro "Sem resposta" + badge com as horas reais, régua única `lib/atendimentos/sem-resposta.ts`) e C2 (badge de coluna lendo a config do worker + produtor de alerta `kanban_parado` com anti-spam, indo para o **dono da oportunidade + gestores**, no agendador). Worker publicado em `/app/stk-worker` e reiniciado — leitura real em produção: **8 conversas >24h sem resposta, 3 oportunidades paradas >72h**.
- **Fase 2 (M1) codificada e publicada:** aba "Remarketing" com preview, auditoria `tipo`/`regra`,
  rotina diária `remarketing_diario` com 5 guardas e métrica de taxa de resposta. **Migration 090
  já aplicada em produção** (verificado: coluna `tipo`, tabela `remarketing_opt_out`, rotina ativa
  com `dry_run: true` e template escrito) — ou seja, **está no modo ensaio, não envia nada**; a 089
  (índices) não dá para conferir de fora (rodar de novo é seguro, é `IF NOT EXISTS`).
- **Fase 3 (C3) CONCLUÍDA em 27/09:** fila `fila_propostas_axs` (migration **091 já aplicada**),
  rota `POST/GET/PATCH /api/axs/fila`, form `axs-novo` **enfileirando** em vez de disparar,
  processador `worker/fila_axs.py` no worker (poll de 15 s, backoff, sino no erro,
  retroalimentação do funil) e tela **`/fila-axs`** com "tentar de novo" e "feito manualmente".
  **A criação na AXS funciona e nasce com mensalidade**: migrou do fluxo público (que gravava
  sem cálculo) para o **fluxo ARP** — `login` (Bearer) → `criar/card` → proposta com
  **mensalidade e economia calculadas**. Payload exato, mapeamentos e armadilhas em
  **`docs/axs-fluxo-oficial.md`**. Worker publicado e reiniciado com o código novo.
- **Performance 26/09:** lentidão relatada em todas as abas → mapeada (medição externa + navegador
  logado com sessão temporária, já apagada) e **duas rodadas de correção aplicadas**:
  (1) Marketing/Disparo: lista de campanhas 28,6 MB/10 s → **142 KB/0,43 s**; (2) CRM: recargas
  duplicadas — **Atendimento 2,0→0,8 s**, **Kanban 1,6→0,6 s**. Faltam (c) base64→Storage,
  (d) cache de navegação e (e) polls. **Ver seção 8.**
- Plano das próximas features aprovado e detalhado em **`docs/plano-acao-modulos.md`** (CRM + Marketing, com decisões D1–D6 fechadas).
- **Fase 4 (M2) CODIFICADA em 27/09:** chatbot com **base de conhecimento**. A IA agora só fala o
  que está na base (editável em `/configuracoes/base-conhecimento`, botão também no `/chatbot`),
  fora dela ela devolve `[[ENCAMINHAR]]` → recado pro cliente + sino com motivo e pergunta, e a
  ordem **chatbot > IA > humano** virou uma única função usada pelos 2 webhooks. Decisão **D7**
  registrada no plano (dúvidas **E** puxar assunto). Bateria de 16 conversas em
  `docs/relatorios/bateria-ia-cobertura.md` (16/16 ✅). Migration `092` **aplicada em 27/09**
  (tabela confirmada no banco, 0 linhas).
  **Estado combinado em 27/09: a base fica VAZIA por enquanto — decisão do João, não é pendência.**
  Hoje isso não tem efeito nenhum na produção: a chave `ia_atendimento` está **false** e o único
  fluxo do chatbot está **inativo**, ou seja, hoje **nada responde sozinho** no WhatsApp. Ela só
  passa a ser necessária no dia em que ele decidir **ligar** a IA — aí é preencher em
  `/configuracoes/base-conhecimento` **antes** de ligar (base vazia + IA ligada = encaminha todo
  mundo pro vendedor). Não cobrar essa tarefa nas próximas sessões, exceto quando ele for ligar a IA.
- **Fase 6 (C4) CONCLUÍDA em 27/09 — documento de proposta em PDF:**
  - **Entidade nova** (antes não existia "proposta", só a oportunidade): migration `093` cria a
    tabela **`propostas`** — 1 por oportunidade, `dados JSONB` com o snapshot do que foi impresso,
    número `PROP-AAAAMMDD-XXXX`, emissão e validade (**30 dias**) — e o **bucket privado
    `propostas`**. Caminho do arquivo é **estável por oportunidade**, então "gerar de novo"
    sobrescreve em vez de deixar PDF órfão.
  - **Fonte dos dados (D9):** payload da proposta na fila AXS (C3) → cadastro do cliente →
    oportunidade (única fonte de valores). Obrigatório: nome/razão, CPF/CNPJ, logradouro+número,
    cidade+UF, UC, concessionária e **ao menos um valor** — o que faltar volta como lista em
    português no botão.
  - **Dois gatilhos (D8):** automático no `PATCH /api/oportunidades` quando a etapa vira
    `contrato_enviado` (falha nunca bloqueia a mudança de etapa, só devolve `proposta_erros`) e
    **botão manual** `components/features/propostas/botao-proposta.tsx` em (a) cada oportunidade
    da aba **GD da pasta do cliente** e (b) **modal da oportunidade**.
  - **PDF:** `lib/propostas/pdf.ts` (pdf-lib, layout próprio em código — o template de
    `public/templates/` é do RECIEE, outra proposta); servidor: `lib/propostas/gerar.ts` +
    `app/api/propostas/route.ts` (gerar/listar) + `app/api/propostas/[id]/arquivo/route.ts` (baixar).
  - **GATES: `npm test` 296/296 (1 skip) · `tsc --noEmit` limpo · `next build` compila · worker 138 unittest.**
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

~~Fase 3 (C3 — fila "cadastrar no CRM → criar na AXS", D4)~~ — **CODIFICADA, TESTADA E PUBLICADA
em 27/09**. O que está pronto:
1. ✅ **Migration `091_fila_propostas_axs.sql`**: tabela da fila (`pendente → enviando →
   criada | erro | manual`, `tentativas`, `proxima_tentativa`, `job_id`, `erro`, `axs_card_id`,
   `payload JSONB`), **índice parcial que só permite 1 item não-finalizado por cliente**
   (não dá para enfileirar a mesma proposta 2×), RLS só para service role, trigger de
   `updated_at` e liberação do tipo de notificação `fila_proposta_axs` no sino.
2. ✅ **Enfileirar**: `POST /api/axs/fila` (sessão obrigatória + validação do payload + resolve
   sozinha a oportunidade do cliente; **409** se já existir item `pendente`/`enviando` do mesmo
   cliente). O form `axs-novo` **não dispara mais** — grava na fila e mostra "Proposta na fila!".
3. ✅ **Processador no worker** (`worker/fila_axs.py`, poll de 15 s dentro do loop existente):
   chama `worker/axs_api.py` → **API da AXS** (6 POSTs) → backoff `60 s × 2ⁿ`
   (teto 15 min), 6 tentativas → `erro` + sino para o vendedor. Antes de reenviar ele
   **retoma o job antigo** (evita criar a mesma proposta 2× na AXS).
4. ✅ **Tela `/fila-axs`** (menu CRM): contadores por status, detalhe do erro, botões
   **"Tentar de novo"** e **"Marcar como feita manualmente"**.
5. ✅ **Retroalimentação do funil**: `criada` (no worker) ou `manual` (no botão) → a
   oportunidade ligada vai para `proposta_feita` **só para frente** (nunca regride) e grava
   `oportunidade_historico`.
6. ✅ **TDD**: 12 + 18 casos vitest (`lib/axs/fila.test.ts`, `app/api/axs/fila/route.test.ts`)
   33 + 5 unittest (`worker/test_fila_axs.py`) e 18 unittest da API da AXS
   (`worker/test_axs_api.py`), RED confirmado antes do código.
   **GATES: `npm test` 200/200 · `tsc --noEmit` limpo · `python3 -m unittest` 115/115 ·
   `next build` compila** (o prerender falha só por env, pré-existente).
   Worker publicado em `/app/stk-worker` (backup do anterior) e reiniciado.

**✅ Fluxo ARP descoberto e implementado (27/09) — a criação agora nasce COM mensalidade.**

Resumo em português do que aconteceu (detalhe técnico em **`docs/axs-fluxo-oficial.md`**):

1. **O primeiro caminho criava a proposta "morta".** A sequência pública que extraí do portal
   gravava os dados (contratante, endereço, fatura, histórico), mas **não passava pelo cálculo**:
   a proposta aparecia com **Mensalidade R$ 0,00** e a fase ficava travada em "Aguardando cadastro".
2. **A área onde o João cria proposta é outra aplicação**, servida em `/arp/`
   (`/arp/assets/index-C0vAx3jo.js`, título "AXS-ARP", 61 endpoints, login com **Bearer**).
3. **Causa raiz de todos os erros de validação**: `fatura.classe` **não** é
   Residencial/Comercial — é **Monofásico/Bifásico/Trifásico** (tipo de conexão), e o grupo vai em
   `fatura.subClasse`. Mandar o inverso fazia o cálculo de consumo nunca passar
   ("Consumo mínimo não atingido"). Junto disso: `observacoes` é **objeto**, `endereco.estado` vai
   **por extenso** ("Goiás"), CEP **com traço**, CPF **mascarado**, `representante` só com os
   campos da sessão (sem `gestor3`/`equipe`/`regional`).
4. **Prova**: dois cards lado a lado na tela de propostas deles — `1451381557` (fluxo antigo)
   **R$ 0,00** e `1451384681` (fluxo ARP, criado pela interface com captura de rede)
   **R$ 4.015,79** de mensalidade e **R$ 21.964,61** de economia anual.
5. **Reescrito com TDD** `worker/axs_api.py`: `montar_login` → `logar` (token com cache por
   sessão) → `montar_proposta` (payload exato de 1655 bytes) → `criar_proposta` (201 + `idCard`),
   com retentativa de login se o token expirar no meio do lote. `worker/fila_axs.py` passou a
   ler **`AXS_ARP_EMAIL`/`AXS_ARP_SENHA`** do env (o código de representante virou lixo).
   **GATES: `npm test` 200/200 · `tsc --noEmit` limpo · `python3 -m unittest` 138/138.**
6. **Leituras ao vivo sem efeito** que ajudaram e continuam úteis:
   `GET /csp/cliente/consultar/card/{id}` funciona **sem token** (mostra o card inteiro),
   `POST /csp/representante/validar/uc` diz se a UC está livre, e
   `POST /csp/representante/coletaDados/fatura` **está quebrado do lado deles**
   (`<CLASS DOES NOT EXIST>`) — ou seja, nem no fluxo manual a AXS lê a imagem da fatura:
   **o cálculo vem dos números, não do arquivo**.
7. ⚠️ `POST /api/axs/send` continua **legado** (pode ser removido depois).

**Pendências da Fase 3 (só do lado humano):**
- preencher **`AXS_ARP_SENHA`** em `/app/stk-worker/env` (o e-mail já está gravado; a senha é
  do acesso ARP — nunca passa pelo chat; depois disso é só me avisar que eu reinicio o worker);
- aplicar a `089` (Fase 1) — a `090` e a `091` já estão aplicadas;
- apagar os 2 cards de teste quando quiser: `1451381557` e `1451384681`
  (nome fictício *Teste Automatizado Stkcrm*);
- (opcional) remover o `POST /api/axs/send` legado.

~~Fase 4 (M2 — chatbot com base de conhecimento)~~ — **CODIFICADA E TESTADA em 27/09**.
O que está pronto:
1. ✅ **Migration `092_base_conhecimento.sql`**: tabela `base_conhecimento` (categoria, título,
   conteúdo, `palavras_chave text[]`, `ativo`), trigger de `updated_at`, RLS no padrão do projeto.
2. ✅ **Tela `/configuracoes/base-conhecimento`**: CRUD completo (criar, editar, apagar, ligar/desligar
   entrada) com aviso quando a base está vazia; botão de acesso no cabeçalho do `/chatbot`.
3. ✅ **Prompt com fonte única**: `montarPromptIA()` puro em `lib/ai-assistant.ts` injeta o bloco da
   base, proíbe inventar e dá a regra **D7** (responder dúvida + puxar assunto, máx. 1–2 sugestões).
   `responderComBase()` carrega a base do banco e devolve `{ texto, encaminhar, motivo }`.
4. ✅ **Guardrail (item 2)**: fora da base (ou base vazia, ou erro da IA) → mensagem de fallback pro
   cliente + notificação `chatbot` com **motivo e pergunta** (`lib/atendimentos/orquestrador.ts`).
5. ✅ **Ordem centralizada (item 3)**: `decidirOrdemResposta()` + `executarAutomacao()` em
   `lib/atendimentos/`, usado pelo webhook WAHA (2 blocos → 1) e pelo legado Evolution (2 blocos → 1);
   a regra de ativação do chatbot saiu de 3 cópias inline para `lib/atendimentos/integrar-chatbot.ts`.
6. ✅ **Bateria (item 4)**: `lib/bateria-ia.test.ts` com 16 casos (9 devem ser cobertos, 7 devem ir
   pro vendedor), relatório gravado em `docs/relatorios/bateria-ia-cobertura.md`; 2ª camada que
   conversa com o Gemini de verdade roda só com `GEMINI_API_KEY` no ambiente.
   **GATES: `npm test` 240/240 (1 skip de rede) · `tsc --noEmit` limpo · `next build` compila.**

**Fase 4 — tudo encerrado do lado humano:**
- migration `092` ✅ aplicada e confirmada (tabela `base_conhecimento` existe);
- **base fica vazia por decisão do João (27/09)** — não é pendência, não cobrar: hoje a IA está
  desligada e o único fluxo do chatbot está inativo, então nada muda. Preencher só no dia em que
  ele decidir **ligar** a IA (e preencher ANTES de ligar: base vazia + IA ligada = encaminha todo
  mundo pro vendedor);
- só se ele pedir: fazer a 2ª camada da bateria (resposta real do Gemini) rodar na CI — precisa da
  chave da IA lá.

~~Fase 6 do plano — C4 (documento de proposta)~~ — **CONCLUÍDA em 27/09** (detalhe na seção 1 e
histórico na seção 7). O que ficou pronto:
1. ✅ migration `093_propostas_documento.sql` — tabela `propostas` + bucket privado `propostas`;
2. ✅ `lib/propostas/documento.ts` (monta e valida o conteúdo, fontes C3→cliente→oportunidade);
3. ✅ `lib/propostas/pdf.ts` (PDF A4 com pdf-lib, texto sanitizado, metadados com o número);
4. ✅ `lib/propostas/gerar.ts` (gerar uma vez, servir dois: botão e gatilho);
5. ✅ rotas `POST/GET /api/propostas` e `GET /api/propostas/[id]/arquivo`;
6. ✅ gatilho automático em `PATCH /api/oportunidades` (etapa `contrato_enviado`, **D8**);
7. ✅ botão "Gerar/Baixar proposta" no modal da oportunidade e na aba GD da pasta do cliente.

**Pendências da Fase 6 (só do lado humano):** aplicar **`supabase/migrations/093_propostas_documento.sql`**
no SQL Editor do Supabase. Enquanto ela não rodar, o botão mostra a mensagem pedindo a migration
(nada quebra no resto do sistema).

**Próxima fase: NÃO EXISTE.** Todas as fases executáveis do plano foram: a Fase 5 do plano (M3
artes com IA + M4 Instagram) **não é executável** — M3 adiado e M4 só estudo, ambos pela **D6** —
e o Pós-Vendas está congelado (**D5**). O que resta são as pendências humanas acima (093, 089,
`AXS_ARP_SENHA`) e as correções de performance (c)(d)(e) da seção 8, além do que o João decidir
como novo item no plano.

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

# Suíte de testes (296 casos, sem rede) — OBRIGATÓRIO antes de dizer "pronto"
npm test

# Type check
npx tsc --noEmit

# Testes do worker (92 casos, sem rede: disparo + agendador + rotinas Fase 1 + remarketing Fase 2 + fila AXS)
cd worker && python3 -m unittest && cd ..

# Rodar o worker de disparo (só quando for testar de verdade)
set -a && . /root/.stk-worker.env && set +a && python3 worker/disparo_worker_waha.py

# Status das sessões WAHA (de dentro do container — URL interna, hairpin NAT)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)
curl -s -H "X-Api-Key: $K" http://172.16.1.1:3000/api/sessions
```

- Env do worker/banco: `/root/.stk-worker.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WAHA_API_URL=http://172.16.1.1:3000`).
- Migrations: `supabase/migrations/` — **087, 088, 090, 091 e 092 aplicadas; 093 (Fase 6 — `propostas` + bucket de PDFs) e 089 (índices Fase 1) escritas, falta aplicar as duas** no SQL Editor (a `scripts/aplicar-migracao.js` NÃO serve: ela chama a RPC `exec_sql`, que não existe neste projeto; não há `psql`/token de gestão aqui dentro — aplicação é manual, no painel do Supabase).
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
| 26/09/2026 | Performance — correções (a)+(b) | Aplicado com TDD o conserto das recargas duplicadas: regras puras em `lib/performance/regras-recarga.ts` (8 testes novos, RED antes), efeito único no Atendimento, guarda de mudança real no Kanban e modal de contatos que só busca aberto. Verificado no navegador (sessão temporária, apagada): `page-data` 2→1 e `oportunidades` 3→1; Atendimento 2,0→0,8 s e Kanban 1,6→0,6 s. 170 vitest + 59 unittest, tsc limpo, build compila, Vercel verde (`3bf2276`). | ✅ aplicado e medido |
| 26/09/2026 | Performance (fora das fases) | Mapeamento da lentidão relatada: medido em produção que `GET /api/bulk/campaigns` devolvia 28,6 MB/10 s (imagens em base64 em `fluxo_mensagens`) e que funções paradas custam 1–4 s (tempo frio). Conserto do item 1 aplicado com TDD (3 testes) e publicado (`15216ad`): **142 KB/0,43 s**. Estão saudáveis: banco (28 atendimentos), consultas 0,1–0,5 s, WAHA 95 ms, mídia com cache. Depois entrou em produção com sessão temporária (apagada ao final) para medir a troca de aba no navegador: RSC 84–250 ms, páginas prontas em 0,5–2,0 s, achando a **chamada duplicada de `page-data`** no Atendimento e as 3 de `oportunidades` no Kanban. Detalhes e próximos passos na seção 8. | ✅ Marketing corrigido e CRM medido; correções (a)–(e) da seção 8 a decidir |
| 27/09/2026 | Fase 3 (C3 fila AXS) | TDD de ponta a ponta: **63 testes novos** (12 em `lib/axs/fila.test.ts`, 18 em `app/api/axs/fila/route.test.ts`, 33 em `worker/test_fila_axs.py`) — RED confirmado antes do código. Entregue: migration **091** (fila + 1 item não-finalizado por cliente + RLS + sino `fila_proposta_axs`), rota `/api/axs/fila` (validação, 409 de duplicidade, permissão vendedor×gestor, retry, "feito manualmente"), form `axs-novo` enfileirando em vez de disparar, processador `worker/fila_axs.py` (backoff 60 s×2ⁿ, retoma o job antigo antes de reenviar, sino no erro, funil → `proposta_feita` só para frente) e tela `/fila-axs` com botões. Worker publicado em `/app/stk-worker` (backup do anterior) e reiniciado. **Descoberta: `2.25.192.248:8080/axs-api` devolve 401 — o serviço Playwright não está publicado.** | ✅ **código pronto — falta aplicar 091 e publicar o axs-api** |
| 26/09/2026 | Fase 2 (M1 Disparo + remarketing) | TDD de ponta a ponta: **18 testes novos** (17 em `lib/marketing/remarketing.test.ts`, 5 em `app/api/bulk/resultado-remarketing/route.test.ts`, 13 em `worker/test_remarketing.py` — RED confirmado antes do código). Entregue: regra única do público (inversa do C1), aba "Remarketing" com preview no servidor, auditoria `tipo`+`regra`, rotina diária `remarketing_diario` com 5 guardas (dry_run padrão ligado, teto 20, cadência 24h, não remarcar 7 dias, opt-out eterno gravado pelo chatbot) e métrica de taxa de resposta na tela. Worker publicado em `/app/stk-worker` (sha idêntico) e reiniciado; rotina testada a frio em produção (15 no público; falha fechada HTTP 400 enquanto a 090 não rodar). migrations 089 e 090 escritas | ✅ **código pronto — falta aplicar 090 (+089) e decidir quando LIGAR** |

| 27/09/2026 | **Fase 4 (M2 — chatbot com base)** | TDD de ponta a ponta: **41 testes novos** (15 em `lib/base-conhecimento.test.ts`, 6 em `lib/ai-assistant.test.ts`, 5 em `lib/atendimentos/orquestrador.test.ts`, 4 novos no webhook WAHA + 3 da bateria de 16 casos) — RED confirmado antes do código. Entregue: migration **092** (tabela + RLS + trigger), tela `/configuracoes/base-conhecimento` (CRUD + aviso de base vazia), prompt `montarPromptIA()` com bloco da base e a regra **D7** (dúvidas **E** puxar assunto), guardrail `[[ENCAMINHAR]]` → fallback + sino com motivo/pergunta, ordem **chatbot > IA > humano** centralizada em `executarAutomacao()` (usada pelos 2 webhooks) e `integrarChatbot()` compartilhado (3 cópias → 1). Bateria com relatório em `docs/relatorios/bateria-ia-cobertura.md`. **Gates: 240 vitest + tsc limpo + `next build` compila.** | ✅ **código pronto — falta aplicar 092 e preencher a base** |
| 27/09/2026 | **Fase 6 (C4 — documento de proposta)** | TDD de ponta a ponta: **56 testes novos** (21 em `lib/propostas/documento.test.ts`, 8 em `lib/propostas/pdf.test.ts` — leem o PDF de volta, descomprimindo os content streams, para conferir que o dado entrou na página, 20 em `app/api/propostas/route.test.ts` e 7 em `app/api/oportunidades/route.test.ts`) — RED confirmado antes do código. Entregue: migration **093** (tabela `propostas` 1:1 com a oportunidade + snapshot do conteúdo + bucket privado `propostas`), `lib/propostas/documento.ts` (fontes C3→cliente→oportunidade, validação D9, validade 30 dias), `lib/propostas/pdf.ts` (A4 com pdf-lib, sanitização de texto), serviço `lib/propostas/gerar.ts`, rotas `POST/GET /api/propostas` + `GET /api/propostas/[id]/arquivo`, **gatilho automático** no `PATCH /api/oportunidades` quando a etapa vira `contrato_enviado` (**D8**, falha nunca bloqueia a etapa) e botão `botao-proposta.tsx` (gerar→baixar, número e validade visíveis, "gerar de novo") no **modal da oportunidade** e na **aba GD da pasta do cliente**. Fake de Supabase (builder + storage) extraído para `lib/testes/supabase-fake.ts` e compartilhado pelos 2 testes de rota. **Gates: 296 vitest + 138 unittest + tsc limpo + `next build` compila.** | ✅ **código pronto — falta aplicar 093** |
| 27/09/2026 | Fase 3 (criação real na AXS) | **Vitória:** a proposta passou a nascer com mensalidade. Causa-raiz achada na interface deles com captura de rede: `classe` é tipo de conexão (Mono/Bi/**Trifásico**) e o grupo vai em `subClasse` — mandar invertido travava tudo em "Consumo mínimo não atingido". Payload exato (1655 bytes) documentado em `docs/axs-fluxo-oficial.md`. `worker/axs_api.py` reescrito com TDD para o fluxo ARP (login Bearer + `criar/card`, token com cache e retentativa), `fila_axs.py` agora lê `AXS_ARP_EMAIL`/`AXS_ARP_SENHA`. **Gates: 200 vitest + 138 unittest + tsc limpo**; worker publicado (`sha256` conferido) e reiniciado. Prova em produção: card `1451384681` com **mensalidade R$ 4.015,79** (o antigo `1451381557` ficou R$ 0,00). Também: `git add -A` derrubou arquivos de trabalho com dados de clientes no repo público → **commit refazido com force-push e `.gitignore` reforçado**; `AXS_ARP_SENHA` pendente (só o João preenche). | ✅ Fase 3 concluída |
| 03/10/2026 | Bugs 03/10 — diagnóstico + **Opção A (IA na MIMO)** | Diagnóstico com prova em produção dos 2 bugs do João. **(1) "IA não respondia":** a IA rodou e caiu no guardrail — notificação `Motivo: erro_ia` = a chamada ao **Gemini falhava** (chave ausente/inválida na Vercel; `.env` local está `[SENSITIVE]`, sem token Vercel para conferir). Toggle IA **grava normal** (registro `atualizado_em` mudou). Achados extras: `fora_horario`/`already_completed`/`blocked_cancelled` retornam "action" truthy e **engolem a resposta** (silêncio total fora do horário — teste do João foi 22h); `palavras_chave` **não** é usado em produção (só na bateria). **(2) "imagem do disparo vira arquivo 422 KB":** `marketing/campanhas` insere **direto no banco** (pula a API que subiria a imagem pro Storage), o passo fica com prefixo `data:image/jpeg;base64,`, o robô manda esse valor pro WAHA (docs exigem base64 puro) → decodificação **corrompida** provada: `fileLength=432548` = bytes COM prefixo (magic `75ab5a8a`, ≠ JPEG) vs 432533 limpos (`ffd8ffe0`); + `numbers` ainda prefixa a instância em massa/avulso → chatId `553@c.us` (1 de 6 falhou no teste). **Opção A implementada com TDD:** `lib/ia-provider.ts` (MIMO `mimo-v2.6-flash` padrão, Gemini legado, seletor `IA_PROVIDER`) consumido por `ai-assistant` **e** pela `engine.interpretarRespostaIA` (exportada; antes travava em `!GEMINI_API_KEY`); guardrail intacto. 17 testes novos RED→GREEN, **gates: 322 vitest + 138 unittest + tsc limpo**. CHANGELOG 1.8.1. **FIM DA SESSÃO (03/10, ~03:40):** Opção A **NO AR** — o João colocou as env na Vercel e o teste `Prazo` (03:26:49) foi respondido pela MIMO em **9s**, com 0 `erro_ia` (toggle IA ON 03:26 → OFF 03:27). Bug da imagem **consertado e provado em produção**: `lib/marketing/disparo-fluxo.ts` (imagem sobe pro Storage; passo = `{type,url,mimetype}`; `montarNumbers` sem a instância) + robô com `limpar_base64()`/`eh_contato()` (publicado, pid 340881, sha conferido); envio de teste às 03:38:32 leu **`fileLength=432533` = limpo** (vs 432548 corrompido). **Gates: 337 vitest + 147 unittest + tsc limpo.** Só o conserto de `fora_horario` (item 1) ficou adiado a pedido do João. |
| 03/10/2026 (2ª leva) | IA responde o que está na base | João apontou que a IA perguntou ("qual serviço?") em vez de responder o cadastrado em `base_conhecimento`. Causas: (1) `palavras_chave` **não** iam no prompt — `montarBlocoConhecimento` só mandava título+conteúdo; (2) as diretrizes D7 ("puxar assunto"/"convide o próximo passo") sem regra de prioridade puxavam a IA pra perguntar. Conserto TDD: palavras-chave no bloco (`- teste viabilidade [prazo]: Vai chegar amanhã`), regra **PRIORIDADE** (casou com a entrada → responde direto, sem esclarecimento; D7 fica depois) e temperature 0.7 → 0.4 no `chamarModelo`. **Gates: 341 vitest + tsc limpo.** Prova ao vivo com o caso real: resposta = *"Para o teste de viabilidade, a previsão é que chegue amanhã..."* (conteúdo da base, sem perguntar). ⚠️ Pode parafrasear (é LLM): se o João quiser a frase LITERAL cadastrada, acrescentar a regra "responda copiando o texto da entrada" — decisão dele. |
| 03/10/2026 (3ª leva) | 4 bugs de tela: Atendimento/Propostas, Fila AXS, ficha de cliente | (1) "Salvar Proposta GD" só salvava cadastro e descartava o consumo → renomeado, campo morto removido, botão "Criar proposta na AXS →" para /clientes/{id}/axs-novo; aba extraída p/ `aba-propostas.tsx` + primeiros testes de UI (testing-library + jsdom instalados). (2) Passo 9: worker derrubava a `mensalidade_axs` do criar/card → `_para_valor` + grava em `clientes.axs_mensalidade` (sem migration), GET /api/axs/fila junta, tela /fila-axs mostra "card X · R$ …". (3) Ficha "Sem nome/Sem CPF/CNPJ": view `v_unified_clientes` usa `nome`/`cpf_cnpj` e a ficha lia `nome_razao_social`/`cnpj_cpf` com a view como 1º SELECT (fallback nunca rodava) → `lib/clientes/normalizar.ts` + páginas (ficha, edição, axs-novo) buscam `clientes` primeiro, view como fallback. (4) Mesma origem na edição (perdia CPF) e no axs-novo (perdia endereço/UC no pré-preenchimento) — corrigido junto. **Gates: 354 vitest + 147 unittest + tsc limpo.** Worker publicado (pid 387030, sha256 ok). Probes de produção: JP 56c486ab completo em `clientes`; CROPS (98d5827f, origem reciee) só na view — batendo com o conserto. |
| 05/10/2026 (LID) | **Disparo: 49/50 falhavam com `no LID found ... @s.whatsapp.net`** | Motor **GOWS** (WAHA 2026.9.1) não resolve PN→LID no envio (WAHA #1714/#2094/#2214, abertos em toda tag). Causa BR: **9 extra na 5ª posição** (wuzapi #243) — só uma grafia resolve. Correção TDD: `variantes_chat_id()` + `enviar_passo()` em `worker/disparo_worker_waha.py` (retry único só em erro de LID; variante vira a padrão do contato); +7 testes → 159 OK; worker publicado e reiniciado. Se persistir: upgrade da imagem WAHA (issues ainda abertas) ou trocar de motor. | ✅ CONCLUÍDO |
| 05/10/2026 (Reenvio) | Botão REENVIAR falhas do disparo | Pedido do João: refazer o envio sem reinserir números/mensagens/imagens. Rota `POST /api/bulk/campaigns/reenviar` (TDD, 5 testes) lê `disparo_logs`, leva só quem tem `err` E nunca `ok` (parciais ficam de fora — sem mensagem duplicada), copia o registro inteiro (fluxo, instância, intervalos) com `status=running` e contadores zerados; robô sem alteração. Tela: botão ↻ âmbar ao lado de Logs quando `failed > 0` e status terminal, com confirmação explicando a regra. **Gates: 363 vitest + tsc limpo.** | ✅ CONCLUÍDO |
| 06/10/2026 (Passo 1) | **Atendimento: cortesia fora do horário enviada** | Bug adiado em 03/10: o engine compunha a resposta "Retornaremos em breve! 😊" no branch `fora_horario` mas `integrarChatbot` só lia `action` → ninguém enviava e o cliente ficava no silêncio (IA bloqueada pela precedência do chatbot). GREEN: branch agora chama `enviarMensagem` antes de retornar; RED do silêncio + controle em horário comercial em `lib/chatbot/engine-horario.test.ts`. **Gates: 365 vitest + tsc limpo.** | ✅ CONCLUÍDO |
| 06/10/2026 (Clientes) | **Tela CLIENTES: ajustes + LOG admin + conserto de save** | IE ⟫removido (PJ), campos novos Nome do Contato/Cargo/CPF do Proprietário/Dt Nascimento, "Endereço da Empresa", Bandeira fora, "Tem Usina Solar" SIM abre o form da usina (CRI/nome/kWp → `clientes.usina`), **Log de Alterações** (menu só admin, rota `/api/clientes/log` 401/403, tabela `cliente_auditoria`). Achei e consertei: Editar NÃO salvava (payload `nome_completo` inexistente → PGRST204) e Novo perdia endereço/energia/consumo — agora os dois usam `montarPayloadCliente` + POST/PUT com trilha de auditoria (best-effort). **PENDÊNCIA HUMANA: aplicar `supabase/migrations/094_clientes_contato_log.sql` no SQL Editor** (a 093 também segue pendente). |
| 06/10/2026 (Status) | Dropdown STATUS = **LEAD/PROSPECT/CLIENTE/CAPTADOR** | Pedido do João; Novo + Editar usam `opcoesStatus` (lib/clientes/status-cliente); valor antigo salvo vira opção extra "(antigo)". Migration 094 **aplicada pelo João** (projeto certo `nizreyg...`) e deploy `dfd2df8`+`ee56696` publicados. |

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

**Correções (a) e (b) APLICADAS e verificadas no navegador** (commit `3bf2276`; regras puras em
`lib/performance/regras-recarga.ts` com 8 testes, RED antes do código; duas passadas de medição):

- **Atendimento: `page-data` 2× → 1×** e `whatsapp/contacts` **some da entrada** (só busca com o
  modal de contatos aberto). Página pronta: **1,77–2,02 s → 0,77–1,09 s** (≈2,4×);
- **Kanban: `oportunidades` 3× → 1×**. Página pronta: **1,60–1,66 s → 0,61–1,26 s** (≈2,6×);
- como ficou: um efeito só no Atendimento (montagem + troca de chat, loading só na primeira) e, no
  Kanban, refaz só quando a lista de conversas muda de verdade (montagem e primeira chegada de
  dados já cobrem o início).

*Ainda medido e não tratado:* `config/ia-toggle` (168–746 ms) e `tarefas/resumo` (377–761 ms) entram
na corrida de carregamento — são pequenos, mas é o próximo degrau se quiserem apertar mais.

**Correções ainda não feitas:**
- **(c) mover as imagens do base64 para o Storage** — o banco volta a ~0,15 MB e para de crescer;
- **(d) cache de navegação** (voltar numa aba já vista sem refazer tudo);
- **(e) reduzir os polls** de 5 s/15 s e consolidar os pedidos da tela de Atendimento.

## 9. Frase de início para a próxima conversa (para o humano)

> **"Leia `/root/stk-crm/docs/HANDOFF.md` e me diga em que ponto o STK-CRM está."**

Protocolo: **toda sessão nova começa em chat novo com uma frase assim** — quem receber lê o HANDOFF
e já sabe onde parou. As fases executáveis do plano acabaram (Fase 6/C4 concluída em 27/09); para
continuar é uma destas duas:
- **pendências humanas**: aplicar a migration `093` (documentos de proposta) e a `089` (índices),
  e preencher `AXS_ARP_SENHA` no env do worker;
- **novo item**: *"Leia o HANDOFF e o plano de ação; quero adicionar o item Z — onde ele entra?"*
A base de conhecimento fica vazia por decisão do João de 27/09 (hoje a IA está desligada e o fluxo
do chatbot está inativo, então nada muda).

Variantes úteis:
- Só para revisar: *"Leia o HANDOFF do STK-CRM e me diga em que ponto estamos."*
- Para pular etapa: *"Leia o HANDOFF, pule a Fase 0 e ataque a Fase 1."*
- Para nova ideia: *"Leia o HANDOFF e o plano de ação; quero adicionar o item Z — onde ele entra?"*
- Depois de preencher a base: *"Rode a bateria de conversas-teste com resposta real do Gemini e me mostra o relatório."*
