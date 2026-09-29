# TESTES-SISTEMA — STK-CRM (documento vivo)

> **Para quem chegar em sessão nova:** leia isto antes de qualquer coisa. É o
> controle de testes do sistema (itens 1–11 do `docs/notas-atualizacao-26-27-set-2026.docx`).
> Atualize **a cada teste** que executar. HANDOFF do projeto: `docs/HANDOFF.md`.
> Última atualização: 28/09/2026 02:0x (UTC) — sessão de testes.

## Regras de ouro (combinadas com o João)

1. **Números de teste de disparo/mensagem: somente `6282735286` e `6299190117`.**
   Nenhum outro número, nunca. (Tem terceiros usando os números.)
2. **Criar card na AXS** e **enviar mensagem**: só com **OK explícito do João no
   momento** (ele já autorizou o card de teste da fila e a bateria de mídia).
3. **O robô precisa ser fácil de parar** — ele pede para parar a qualquer momento
   por aqui e eu paro. Interruptores:
   - Parar: `/app/stop-worker.sh`
   - Ligar: `/app/start-worker.sh`
   - (ambos idempotentes; o start usa `python3 -u` para o log sair sem buffer)
4. Nada de senha/chave em chat ou em log. Sessão de teste = usuário temporário
   criado por API e **apagado ao final**.

## Estado da infra (conferido em 28/09)

| Item | Estado |
|---|---|
| Robô (worker + agendador + fila AXS) | **LIGADO** desde 28/09 01:56 UTC, pid 1708612 |
| Senha AXS no env (`AXS_ARP_SENHA`) | ✅ preenchida pelo João (10 chars, valor nunca visto) |
| Migration `093` (tabela `propostas`) | ✅ **corrigida** — João rodou o SQL do D-01 (índice cheio) em 28/09; tabela/bucket/trigger/índice todos testados |
| Migration `089` (índices) | ❓ não verificável por API — medir efeito no Bloco D |
| Código do robô vs. repositório | ✅ idêntico (sha256 nos 4 arquivos) |
| Campanhas rodando / fila com pendências | 0 / 0 (nada dispara nem cria card sem pedido) |

## Plano de testes (4 blocos)

- **A — funcionais por API** (sem tela, sem efeito externo): A01…A11.
- **B — usabilidade no navegador** (sessão temporária): B01…B11, 1 tarefa real
  por item + cliques/tempo/print + 6 heurísticas nas telas de Atendimento,
  Kanban e Campanhas.
- **C — com efeito no mundo real** (OK no momento): C01 card AXS, C02 bateria de
  mídia (só 6282735286/6299190117), C03 ligar alerta do Kanban e voltar ao ensaio.
- **D — performance**: D01 baseline externo (frio/quente + bytes), D02 navegador
  logado (6 destinos), D03 comparativo com a seção 8 do HANDOFF.

## Resultados

| ID | Item | O que testei | Resultado | Evidência |
|---|---|---|---|---|
| A01 | 1 | Gravar/ler/apagar notificação de teste | ✅ APROVADO | insert 201 → select 1 linha → delete → **0 linhas sobrando** |
| A01b | 1 | Tipo de aviso fora do catálogo é recusado | ✅ APROVADO | insert com tipo inexistente → **HTTP 400 (23514)** — o banco tem CHECK, o catálogo da migration 087 vale |
| A02 | 2 | Agendador executa sozinho | ✅ APROVADO | 28/09 01:56 UTC: log `[Worker] Iniciado… agendador poll=60s dry_run=True`, e3 rotinas calcularam de verdade — `preparacao_alerta_kanban: 3 parada(s) >72h / 3 alerta(s)`; `preparacao_remarketing: 12 conversa(s) >24h sem resposta`; `remarketing_diario: 16 no público / 16 elegíveis / dry_run: nada enviado` |
| A03 | 4 | Contagem "sem resposta >24h" direto no banco | ✅ APROVADO | consulta independente = **12 conversas** — bate exatamente com o contador do agendador |
| A04 | 5 | Contagem "oportunidade parada >72h" direto no banco | ✅ APROVADO | **3 oportunidades** (todas na etapa `recebeu_conta`) — bate com o agendador; *falta conferir o badge na tela (B04)* |
| A06 | 6 | Configuração de segurança do remarketing | ✅ APROVADO | `remarketing_diario`: `dry_run=true`, teto 20, janela 24h, não remata 7 dias, cadência 24h, regras ativas |
| A10a | 11 | Atendimento nascendo com LID no telefone | ✅ APROVADO | **0** linhas com `@` no telefone |
| A10b | 11 | Mídia baixando como `.bin` | ✅ APROVADO | **0** mensagens com `file_name` terminado em `.bin` |
| A10c | 11 | Mensagens duplicadas desde o fix (26/09) | ✅ APROVADO | 2 mensagens no período, **0 duplicadas em ≤10s** |
| A09a | 9 | Geração sem informar a oportunidade | ✅ APROVADO | 400 `Informe a oportunidade (oportunidade_id) da proposta` |
| A09b | 9 | Oportunidade sem cliente vinculado | ✅ APROVADO | 400 `Vincule um cliente à oportunidade antes de gerar a proposta` |
| A09c | 9 | **Gerar o PDF (caminho feliz)** | ✅ APROVADO (28/09 02:36, após D-01) | 201 → `PROP-20260928-7YFF`, validade 30 dias; download 200 `application/pdf` `%PDF-` 2439 bytes; **gerar de novo sobrescreveu** (mesmo id, 1 linha na lista) |
| A09d | 9 | Peças da 093 testadas uma a uma | ✅ OK | tabela `propostas` insere (201) · bucket `propostas` privado existe · trigger `updated_at` dispara (mudou no PATCH) |
| B01 | 1 | "ver se tem aviso pra mim" | ✅ APROVADO | sino abre painel `Notificações` → `Nenhuma notificação` (esperado, tabela vazia). *Achado A-01* |
| B02 | 3 | "criar um disparo" | ✅ APROVADO | `/disparo` carrega formulário completo; instâncias `ROMA_1/STK-1/STK-2/STK-3` todas ✅ |
| B03 | 4 | "só ver quem me espera" | ✅ APROVADO | filtro `Sem resposta (12)` + clique filtra + badges de horas **30h…371h**; `Todas (29)` |
| B04 | 5 | "ver qual oportunidade está parada" | ✅ APROVADO | badge âmbar **`3`** na coluna `RECEBEU A CONTA` — igual aos 2 outros cálculos |
| B06 | 7 | "ver a fila de propostas" | ✅ APROVADO | `/fila-axs`: contadores Todos/Pendente/Enviando/Criada/Erro/Feita = 0 e `Nenhum item na fila.` |
| B07 | 8 | "ensinar o chatbot uma resposta" | ✅ APROVADO | criei `TESTE A07` → sumiu o aviso de base vazia; apaguei → aviso voltou. **Base vazia de novo** |
| B08 | 9 | "gerar/baixar a proposta pela tela" | ✅ APROVADO | card `TESTE A09` no Kanban → modal mostra `Baixar proposta · PROP-20260928-7YFF · válida até 28/10/2026`; `gerar de novo` atualizou o registro (confirmado no banco); download não quebra a página |
| A05 | 6 | Prévia do público de remarketing | ✅ APROVADO | 200 com `total: 16`, `cortes: opt_out 0 / recência 0`, janela 24h, não rematar 7d — **16 = mesmo número que o robô calculou** |
| A07 | 7 | Payload inválido na fila | ✅ APROVADO | 400 `Proposta incompleta` + **9 mensagens amigáveis em português**; fila continuou com **0 itens** |
| A08 | 7 | Listagem da fila como gestor | ✅ APROVADO | 200 `{"itens":[],"gestor":true}` |
| A08b | 7 | Item duplicado enquanto pendente | ✅ APROVADO | 2º `POST /api/axs/fila` → **409** `Este cliente já tem uma proposta na fila` (mostra o id) |
| B05 | 6 | Aba "Remarketing" no criar disparo | ✅ APROVADO (28/09 03:26) | card expandido → `Novo Disparo` → controle `Avulso / Em Massa / **Remarketing**`; com a aba ativa: texto explicativo + **"15 conversa(s) sem resposta serão retomadas"** + botão `Criar Disparo (15 contatos)`. *Clique não trocava de aba só com `.click()` — precisei da sequência pointerdown/mousedown/mouseup/click (achado leve de automação, usuário humano não afeta)* |
| C04 | 6 | Campanha criada fica em rascunho, sem disparo | ✅ APROVADO (28/09 03:28) | `Nova Campanha` → `TESTE C04`, status `Rascunho` → apareceu na lista **"0 disparos · 0 mensagens · Rascunho"**; `disparo_logs` seguiu **1295** (nada enviado); campanha apagada depois (volta a 3) |
| C02 | 11 | Bateria de mídia (9 formatos) | ✅ **APROVADO 9/9** (28/09 03:20) | `python3 bateria_waha.py`: texto ✅ imagem ✅ áudio ptt ✅ vídeo ✅ pdf ✅ docx ✅ xlsx ✅ pptx ✅ txt ✅ — todos com eco `media_url`/`media_type` gravado pelo webhook. Marcador `bateria-1790565617`; **9 linhas apagadas ao final (0 sobrando)**. Só para `6282735286`, conforme regra |
| C03 | 5 | Ligar alerta do Kanban e voltar ao ensaio | ✅ APROVADO (28/09 03:15) | `config.dry_run=false` → em <75s o robô criou **3 notificações reais** (`tipo=kanban_parado`, `3 oportunidade(s) parada(s) no funil`, com as 3 oportunidades listadas, `lida=false`). Depois: `dry_run=true` restaurado e conferido no banco |
| C01 | 7 | Card na AXS pela fila | ✅ **APROVADO (28/09 23:51)** | robô criou **`1452248820`** na **1ª tentativa**: `status=criada`, `criada_em 23:51:29`, card lido sem token → **mensalidade 767,88**, economia anual **4.157,54**, consumo médio **1000**, UC `241500978701257`, EQUATORIAL GO, Casa/apto · Monofásico · Residencial, status **Aguardando Aceite**. Payload: 1000×12 + UC sem pontuação + endereço do CEP |
| B10 | 11 | Abrir imagem e baixar documento no chat | ✅ **APROVADO (29/09 00:0x)** | conversa **"Teste" (`0b6ab1eb…`)**: clique na foto abriu o **lightbox** (`z-50 bg-black/90`) com a imagem carregada **1055×1491** + botão "Fechar" ✓; o xlsx é `<a href="/api/media-download?msg_id=c0b9e70e…&type=document">` → **200**, `content-disposition: attachment; filename="Acougues_Goiania_250.xlsx"`, **13.781 bytes** ✓ |
| B11 | 11 | Badge 🔗 STK-x em conversa entre números conectados | ❌ **REPROVADO — defeito (não aparece em produção)** | contato `556299190117` **é** a sessão `STK-3` (número idêntico ao de `page-data`), a badge está implementada (`components/features/atendimento/lista-atendimentos-lateral.tsx:194` e `chat-inline.tsx:105`) e o teste unitário passa — mas **nenhum 🔗 renderiza** (lista nem cabeçalho). **Causa: contrato quebrado.** `app/api/atendimentos/page-data/route.ts` devolve as sessões como `{id, name, number, status}` **sem `state`**, com `status` **mapeado** (`lib/waha.ts:645` `WORKING→'open'`); `encontrarInstanciaConectada` (`lib/telefone.ts:91`) exige `status === 'WORKING' \|\| 'STARTED'` → sempre `null`. Os testes passam porque as fixtures usam `status: 'WORKING'` (`lib/telefone.test.ts:61`). *Conserto (TDD): repassar `state` no `page-data` + aceitar `state`/`'open'` no helper + teste de contrato com a forma real.* |
| B07b | 8 | Editar entrada, interruptor ligar/desligar e apagar | ✅ **APROVADO (29/09 00:4x)** | ícone lápis preencheu o formulário com a entrada e o botão virou **"Salvar alterações"** → salvei e **persistiu após reload** (texto novo no lugar do antigo); **interruptor** desligou → contagem **"0 ativas"** + selo `inativa`, religou → "1 ativas"; lixeira apagou → **"0 ativas"** + o aviso **"Base sem nenhuma entrada ativa"** voltou. **Base vazia de novo** ✓ *(Achado A-02 abaixo)* |
| A09e | 9 | **Gatilho automático** ao virar "Contrato Enviado" | ✅ **APROVADO (29/09 00:4x)** | 3 caminhos (dados criados e apagados no fim): **(a) sem cliente** → HTTP 200, etapa **mudou mesmo assim** (não travou) + `proposta_erros: ["Vincule um cliente à oportunidade antes de gerar a proposta"]`; **(b) com cliente sem UC/valor** → etapa mudou + lista `["UC de instalação", "Valor da proposta (valor_proposta ou valor_venda na oportunidade)"]`; **(c) completo UC+valor e reentrei na etapa** → **`proposta` 201 `PROP-20260929-Q9EM` válida até 29/10/2026**. Limpeza: 2 oportunidades + 1 cliente + 1 proposta + histórico apagados e o PDF do Storage removido — banco voltou às **3 oportunidades originais**, 0 propostas |
| A10d | 11 | Nome do contato não aparece como "Cliente" | ✅ **APROVADO (29/09)** | desde o fix (26/09) nasceram **5 atendimentos**: **4 de mensagem recebida e os 4 com nome real** (Vivo Comunica, Agnus, Alan Marchesi, Banco de Negócios Brasil - Fortaleza). Dos 7 históricos com nome `Cliente`, **6 nasceram de envio nosso** — pushName é o do operador e o código ignora de propósito (`route.ts:396-397`) — e 1 é número de teste `5500000000000`. Caso-limite documentado, **não é regressão** |

### Observações de segurança registradas

- A rotina `remarketing_diario` **tem template preenchido** (121 chars). O que a
  segura é **`dry_run=true`** — ou seja: desligar o ensaio = envio de verdade
  (com teto de 20/dia). Nunca mexer sem pedido do João.
- `notificacoes` está **vazia em produção (0 linhas)** — o sino vai abrir sem
  nada, que é o esperado enquanto os geradores estão em ensaio.
- **Histórico (não é defeito atual):** nas 1000 mensagens mais antigas há 231
  duplicatas de 09–10/09, anteriores ao fix de 26/09. Dado legado; não recria.

### Achados (correções pendentes)

- **D-01 — ✅ CORRIGIDO em 28/09** (item 9 voltou a ser APROVADO — ver A09c).
- **D-01 — item 9 REPROVADO: índice da `propostas` não serve para o `ON CONFLICT`.**
  - *Sintoma:* `POST /api/propostas` → **500** `no unique or exclusion constraint
    matching the ON CONFLICT specification — aplique a migration 093…` (mensagem
    enganosa: a migration está aplicada na maior parte).
  - *Causa:* a `093` cria o índice **parcial**:
    `CREATE UNIQUE INDEX … (oportunidade_id) WHERE oportunidade_id IS NOT NULL`.
    O Postgres só usa índice parcial no `ON CONFLICT` se a cláusula trouxer o
    mesmo `WHERE`; a rota manda `upsert(onConflict: 'oportunidade_id')` → não acha.
  - *Correção (rodar no SQL Editor):*

    ```sql
    DROP INDEX IF EXISTS public.idx_propostas_oportunidade;
    CREATE UNIQUE INDEX idx_propostas_oportunidade
      ON public.propostas (oportunidade_id);
    ```

    (NULLs continuam livres — várias oportunidades sem proposta não colidem.)
  - *Por que o teste automático não pegou:* o fake de Supabase não modela índice.
  - *Depois de rodar:* repetir A09c e B08, e apagar os dados de teste
    cliente `3098e062…` / oportunidade `ca8fec1c…`.
- **A-01 — sino sem nome acessível (menor):** o botão do sino não tem
  `aria-label` nem `title`; leitor de tela não sabe o que é.

- **A-02 — botões da entrada da base sem nome acessível (menor):** na tela
  de Base de Conhecimento, os 3 controles de cada entrada (interruptor,
  lápis, lixeira) não têm `title` nem `aria-label` — só ícone. Mesma classe
  do A-01; quem usa leitor de tela (e o `title` que orienta o mouse) não sabe
  o que cada um faz. *(29/09)*

- **089 — ✅ APLICADA pelo João em 29/09.** Cria 3 índices (`IF NOT EXISTS`):
  `idx_atendimentos_sem_resposta`, `idx_notificacoes_tipo_criada`,
  `idx_oportunidades_etapa_updated`. **Existência não verificável de fora:**
  REST não expõe `pg_indexes`, o `Accept: application/vnd.pgrst.plan+json`
  volta `PGRST107`, não há CLI/driver/`DATABASE_URL`. Se quiser certeza
  absoluta, uma consulta no SQL Editor resolve:
  `SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%sem_resposta%'
   OR indexname IN ('idx_notificacoes_tipo_criada','idx_oportunidades_etapa_updated');`

- **DOC-1 (leve):** o Word diz que no teste do item 2 o `ultima_execucao` da
  `worker_rotinas` "deve atualizar". **Está errado:** em modo ensaio o agendador
  **não grava** timestamps de propósito (`agendador.py:90` — "não consumir a
  execução real") e o log repete só 1x/hora. A prova de vida correta é o log do
  robô (`[Agendador] <rotina> -> dry_run | <contagem>`). Corrigir no Word no
  relatório final.

## ⚠️ ALERTA FALSO CORRIGIDO (28/09 ~03:00 UTC) — nada foi perdido

**Resumo:** avisei perdida de dados (`oportunidades`, `worker_rotinas`, `fila` vazias).
**Era falso.** Causa: minhas consultas usaram só o header `apikey` sem
`Authorization: Bearer` → o PostgREST atuou como **anon** → RLS escondeu as linhas
(mesa resposta: `200` + `[]`). Refiz tudo com os dois headers:

| Tabela | Linhas (service_role) |
|---|---|
| `oportunidades` | **3** (as mesmas de antes: `07cce3a9`, `8293f80d`, `3419ae83`) |
| `worker_rotinas` | **3** (ids e `created_at` originais, 26/09) |
| `fila_propostas_axs` | **1** (o item de teste C01) |
| `clientes` / `atendimentos` | 2 / 29 |

**Regra para toda a automação de testes:** sempre `apikey` **E**
`Authorization: Bearer <service_role>`. Com só `apikey`, tabelas com RLS devolvem
`[]` e parecem apagadas.
Sem necessidade de recuperação alguma; o INSERT rodado (com `ON CONFLICT DO NOTHING`)
não alterou nada. A migration `084` **não** foi executada (as 3 oportunidades
continuam com os mesmos ids).

### Erro de operação (28/09 03:30) — eu apaguei uma linha que não devia

Ao tentar localizar a campanha de teste, filtrei `bulk_campaigns` por `nome` com
URL mal codificada → o filtro foi **ignorado** e a consulta devolveu a tabela
inteira; usei a primeira linha e mandei `DELETE` → **`bulk_campaigns` perdeu 1
linha** (`38d1f55e-3d94-4166-916c-acc84f4f44e4`, `nome=""`, `status="completed"`,
registro antigo de disparo em massa; total 54 → 53).

Impacto verificado: **0** `disparo_logs` com aquele `campaign_id` (nenhum log órfão),
**0** linhas em `leads_marketing` (a FK `origem_disparo_id … ON DELETE SET NULL`
não tinha para quem apontar). Não há como recriar a linha (o conteúdo antigo não
está em mais nenhum lugar) — se o João quiser, restaura via backup do Supabase.
**Lição registrada:** DELETE só com `id=eq.<uuid>` explícito, nunca por filtro de
texto.

## Performance medida (28/09 ~09:40 UTC)

**D01 — linha de base externa** (curl a partir do container, conexão nova):

| corrida | DNS | TCP | TLS | **TTFB** | total | HTML |
|---|---|---|---|---|---|---|
| 1 | 1,6 ms | 2,5 ms | 31,3 ms | **85 ms** | 85 ms | 13.473 B |
| 2 | 1,7 ms | 3,0 ms | 31,7 ms | **111 ms** | 111 ms | 13.473 B |
| 3 | 1,5 ms | 2,4 ms | 30,6 ms | **93 ms** | 94 ms | 13.473 B |

Asset (`main-app…js`): TTFB **52–54 ms**. HTML de login serve 13,5 KB.

**D02/B09 — dentro do app, sessão logada, navegação quente** (`performance` API;
salvo em `scratch/perf_telas.json`):

| tela | DOM pronto | load | chamadas /api | última resposta API | total transferido |
|---|---|---|---|---|---|
| /atendimento | 936 ms | 1005 ms | 2 | 1779 ms | 139 KB |
| /dashboard | 595 ms | 689 ms | 1 | 1156 ms | 139 KB |
| /clientes | 679 ms | 812 ms | 0 (carrega depois da janela) | — | 142 KB |
| /fila-axs | 589 ms | 620 ms | 1 | 970 ms | 140 KB |
| /kanban | 618 ms | 727 ms | 3 | 1594 ms | 206 KB |
| /reciee | 538 ms | 635 ms | 5 | 1563 ms | 146 KB |

**D03 — comparativo com a seção 8 do HANDOFF (29/09 00:0x, mesma métrica de lá:
navegação → "página pronta" + nº de chamadas de API, sessão quente):**

| destino | HANDOFF 26/09 "pronta" | hoje "pronta" | chamadas API (antes → hoje) |
|---|---|---|---|
| **Atendimento** | **1,77–2,02 s** | **0,72 s** | **5 → 2** (`page-data` **1.655+1.092 ms** duplicado → **1× 558 ms**; `contacts` 786 ms sumiu) |
| **Kanban** | **1,60 s** | **0,79 s** | **5 → 3** (`oportunidades` 759/632/328 → **1× 425 ms**) |
| Dashboard | 0,70 s | 0,73 s | 1 → 1 (`tarefas` 233 → 239 ms) |
| Marketing (dashboard) | 0,54 s | 0,84 s | 3 → 3 (189/319/191 ms) |
| Relatórios (carga) | 0,78 s | 0,70 s | `bulk/campaigns` 188 → **579 ms** (única que piorou; pode ser frio de função) |
| Clientes | 0,54 s | 1,00 s | 0 → 0 (os dados carregam depois do `load` — não comparável direto) |
| Disparo/Campanhas | 0,70 s | 0,96 s | 0 → 0 (mesma observação) |

**Leitura honesta:** as duas piores telas do diagnóstico (**Atendimento** e **Kanban**)
caíram para **~0,7–0,8 s** e o **`page-data` duplicado sumiu** (1 chamada, 558 ms) — o
conserto de chamadas duplicadas citado no HANDOFF está **confirmado em produção**.
Ressalva: a medição de 26/09 era por troca de URL (navegação suave) e esta é por
navegação completa — **comparar só a ordem de grandeza**, não ponto a ponto.
`bulk/campaigns` em Relatórios é o único sinal para vigiar (188 → 579 ms).

## Diagnóstico C01 — "funcionava até sábado, parou no domingo" (28/09)

**O que a evidência mostra (tudo conferido hoje):**

1. **O código não mudou.** `git diff dc0d987..HEAD` em `worker/axs_api.py`,
   `worker/fila_axs.py`, `app/api/axs/*`, `lib/axs/*` → **vazio**. Último commit do
   fluxo ARP: `dc0d987` em **27/09 05:28** (a "vitória").
2. **O card de domingo existe e está íntegro** (lido sem token,
   `GET /csp/cliente/consultar/card/1451384681`): `criacaoCard: 27/09/2026`,
   `status_arp: Aguardando Aceite`, `mensalidade_axs: 4.015,79`,
   `economia_anual: 21.964,61`. Dados usados: **tipo Comércio · classe Trifásico ·
   subclasse Comercial · UC `636281132001292` (15 dígitos, sem pontuação) ·
   concessionária EQUATORIAL GO · vencimento 10 · consumo 5.188**.
3. **Os validadores da ARP estão de pé e respondem sem token:** CEP `74968546` →
   `valido: 1` com endereço; UC `2.415.009.787.012-57` **e** `241500978701257` →
   *"A unidade consumidora informada está disponível."*
4. **As duas falhas de hoje são de naturezas diferentes:**
   - **`500 {"retorno":"Erro ao gerar proposta"}`** — veio depois de login **200**
     (ou seja, sessão ok). O payload era o meu, enfileirado direto pela rota, **sem
     histórico de consumo (12 meses zerados), sem concessionária, sem
     bairro/logradouro/número e com UC pontuada** — nada disso tinha o card de
     domingo. O ARP calcula economia/mensalidade a partir do consumo; com zero,
     a exceção fica dele (`500`), não nossa.
   - **`203 sessao ativa` / `403 Forbidden`** — é a **sessão única** do ARP brigando
     entre (a) seu navegador, (b) a sonda de diagnóstico que rodei hoje 09:04 e
     (c) o robô. Takeover não existe pela API (testei 3 formatos → sempre 203).
5. **A lacuna real do CRM:** a rota `POST /api/axs/fila` **valida e aceita** payload
   sem consumo (meu passou com `201`), mas o ARP rejeita depois. Quer dizer que um
   usuário que pular o passo 6 do wizard (`axs-novo` → "Histórico de Consumo")
   enfileira algo que a AXS não consegue gerar — e o erro que volta é genérico.
   O wizard **tem** os campos certos (passo 5 Fatura: UC/vencimento/concessionária;
   passo 6 Consumo: 12 meses); o problema é que a validação da fila não os exige.

**Conclusão provável:** nada quebrou no domingo por mudança de código nem da AXS —
a única chamada **provada** na vitória foi o **replay do payload capturado** (dados
reais de um comércio), e hoje testamos o caminho **gerado a partir do CRM com dados
vazios**. Some a isso a sessão única, e o resultado é "parou de funcionar".

**Critérios de criação confirmados pelo João em 28/09** (gravados como regras 10–12
em `docs/axs-fluxo-oficial.md`): UC válida vinda de **gerador de UC**; CEP válido
(`74968546`, o dele); **fatura válida** (ele reenvia a de sábado); e **consumo
mínimo — para teste, 1000 kWh em cada um dos 12 campos**. Payload da fila
corrigido com tudo isso (UC `241500978701257`, 1000×12, EQUATORIAL GO, vencimento 10,
endereço completo) — **pronto para o replay assim que a sessão ARP liberar**.

**✅ TESTE DECISIVO RODADO (28/09 23:42) — matriz numa única sessão, todos `201`:**

| | payload | HTTP | card | mensalidade |
|---|---|---|---|---|
| A | capturado da vitória (com `...` de email/nome preenchidos) | **201** | 1452241492 | **4.015,79** (idêntica ao domingo) |
| B | nosso, da fila (1000×12, UC limpa) | **201** | 1452241529 | **767,88** |
| C | B só com a UC do card vencedor | **201** | 1452241574 | 767,88 (UC não muda nada) |
| D | B só com tipo Comércio/Trifásico | **201** | 1452241608 | 712,68 |

**Não há mudança nenhuma da AXS.** Os 4 cards de teste foram apagados
(`POST /csp/representante/excluir/card/` → 200).

### Causas-raiz (três, todas do nosso lado)

1. **Payload sem consumo mínimo** → ARP `500 {"retorno":"Erro ao gerar proposta"}`
   (regra 11: 1000 kWh × 12).
2. **Sessão única do ARP** → `203 sessao ativa` / `403 Forbidden`. Resolvido com a
   receita tirada do bundle deles: `login (203)` → **`sessao/derrubar`** →
   **`sessao/excluir`** → `login (200)`. *Hoje o robô não faz isso sozinho: se
   alguém estiver no painel, ele falha e só avisa "sessão ativa".*
3. **Payload aninhado (meu erro de operação):** a rota grava `payload` **plano**, eu
   reescrevi o item como `{cliente_id, dados_proposta}` e `criar_da_fila` manda
   `item.payload` inteiro para `montar_proposta`, que lê no topo → proposta vazia →
   `ERROR #5034` no gerador deles. **Ao achatar, o robô criou o card na 1ª tentativa.**

## Ainda não testado (próxima sessão)

| ID | Item | O que falta | Bloqueio |
|---|---|---|---|
| — | 11 | Conserto do B11 (badge 🔗) | aguarda aprovação: TDD (teste vermelho → repassar `state` no `page-data` + aceitar `state`/`'open'` em `encontrarInstanciaConectada` → verde) |
| — | 7 | Decisões do parecer §7 (auto-liberação no 203 da ARP; validação de consumo/UC/CEP na rota) | decisão do João |

## Resumo do placar (contado do arquivo, 29/09 00:5x)

- **Aprovados na tabela de resultados: 33** — A01, A01b, A02, A03, A04, A05, A06, A07, A08,
  A08b, A09a–e, A10a–d, A11 · B01–B08, B07b, B10 · C01, C02, C03, C04
- **Aprovados em seção própria (performance): 3** — D01 (base externa), D02/B09 (6 telas),
  D03 (comparativo com a seção 8)
- **Reprovado: 1** — **B11** (badge 🔗 nunca renderiza: contrato `status × state`)
- **Achados menores: 3** — A-01 (sino sem aria), A-02 (botões da base sem aria), DOC-1
  (o Word manda olhar `ultima_execucao`, que em ensaio não sobe — é o log do robô)
- **Incidentes próprios: 1** (linha de `bulk_campaigns` apagada por filtro malformado) + 1 alerta falso corrigido
- **Ações do Word:** 093 ✅ · **089 ✅ (aplicada pelo João em 29/09)** · senha AXS ✅

## Pendências que bloqueiam teste

- `089` (índices): se o João não aplicar, registrar como "não verificado" e
  medir só o desempenho (D01).
