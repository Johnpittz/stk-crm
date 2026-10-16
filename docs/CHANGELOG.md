# CHANGELOG — STK CRM

> Registro das features implementadas. Últimas 10 entradas.

---

## 1.8.26 — 16/10/2026

- **Parte 8 — Leads: importar lista e escolher leads na massa (item 8):**
  - **/marketing/leads** ganhou o botão **"📥 Importar lista"** (PDF,
    DOCX, TXT, CSV, XLSX/XLS): rota `POST /api/marketing/leads/importar`
    extrai os textos (pdf-parse v2, mammoth, SheetJS), acha os telefones
    BR (`lib/leads/extrair-leads.ts`) e grava em `leads_marketing`
    (origem "outro", notas com o nome do arquivo).
  - **Disparo em massa** (aba "Em Massa" do Criar Disparo): botão
    **"📇 Escolher leads do cadastro"** — diálogo com busca e seleção
    que junta os leads escolhidos aos contatos da planilha sem duplicar
    (`lib/leads/selecionar-leads.ts`).
  - Testes novos: 8 (extração/normalização) + 4 (seleção/mesclagem).
  - PDF via `pdf2json` (mesmo helper da IA de conta — pdf-parse falha
    no bundle do Next: worker não copiado / XRef corrompido); DOCX via
    mammoth; planilha via SheetJS; texto puro (.txt/.csv) direto.

## 1.8.25 — 16/10/2026

- **Parte 2 — um único menu Disparo (item 2, decisão do João: "sem
  Campanhas"):** `/disparo` virou a tela única com 3 seções empilhadas
  (sem abas): **Criar disparo** (BulkSender + carga da arte),
  **Campanhas** (com Novo Disparo, massa e remarketing) e **Relatórios**.
  Menu marketing perdeu "Campanhas" e "Relatórios"; descrição do Disparo
  atualizada. Teste da composição da tela (2 testes jsdom).

## 1.8.24 — 16/10/2026

- **Parte 9 — origem do disparo (item 9):** coluna **"Número de origem"**
  na tabela "Disparos desta Campanha" e a caixa "Origem do disparo" no
  detalhe agora mostram o **📞 número** da sessão WAHA usada (resolve
  `instancia` via `/api/instances`; sem número → nome da sessão; sem
  instancia → "-"). Helper puro `lib/marketing/origem-disparo` (8 testes:
  mapa, formato pt-BR +55 DDD 99999-8888 e fallbacks).

## 1.8.23 — 16/10/2026

- **Plano de mudanças do João:** `docs/plano-mudancas-16-10.md` (10 itens,
  execução por partes com teste cada).
- **Parte 1 — Log de Alterações TESTADO (item 6):** unit já cobria
  criação/edição (10/10); teste AO VIVO na produção: cliente de teste
  criado → trilha `criado` com campos → editado cidade → trilha
  `editado: cidade`, autor admin@stk.com. Sem bug — apenas verificado.
- **Parte 2 — modal de disparo não fecha mais fora (item 10):** diálogo
  "Criar Disparo" (Campanhas) ganhou `onPointerDownOutside` que
  previne o fechamento — texto não se perde; fecha só com X ou ESC.

## 1.8.22 — 15/10/2026

- **FIX — vendedor novo não aparecia em Configurações → Equipe.**
  O RUBENS nasceu só na autenticação: o gatilho que preenchia
  `profiles` não existe mais no banco. Cadastro dele criado à mão
  (cargo vendedor) e a rota `/api/auth/cadastro` agora GARANTE a
  linha (upsert com cargo "vendedor") em vez de update cego que
  some em silêncio. Testes novos: 548.

## 1.8.21 — 13/10/2026

- **FIX (ao vivo): arte não gerava — Gemini HTTP 400.** As partes de
  texto do prompt saíam com o campo `type` interno
  (`{type:"text",text}`) e a API do Google recusa campo extra: "Unknown
  name type at contents[0].parts[0]". Agora `montarPartesImagem`
  emite só `{text}`/`{inlineData}` **e** `gerarImagemGemini` sanitiza
  as partes (qualquer chave além de text/inlineData é descartada).
  Testes passaram a exigir `not.toContain('"type"')`. 543 vitest.

## 1.8.20 — 12/10/2026 (LOCAL — aguarda migration 099)

- **PEDIDO 4 — pasta do cliente ganha 4 linhas de negócio:** abas
  **Eletroposto**, **Sigma Solar (monitoramento de usinas)**,
  **BESS** e **Gestão de Fatura** (GD e RECIEE já existiam).
  - Nova tabela genérica `cliente_pasta_linhas` (migration `099`)
    com `linha` + `dados` JSONB.
  - Catálogo/validação/formato puros em `lib/clientes/linhas.ts`
    (moeda pt-BR, competência Mês/AAAA, ranges por linha).
  - Componentes genéricos `TabLinhaSimples` (1 registro por cliente:
    campos + Editar/Excluir) e `TabGestaoFatura` (lista mensal) em
    `components/features/clientes/tabs-linhas.tsx`.
  - Página da pasta: +4 entradas de TABS (ícones PlugZap/Sun/
    Battery/Receipt), carga sob demanda e CRUD no supabase.
  - Gates: 542 testes (+21 RED→GREEN) + tsc + build + unittest.

## 1.8.19 — 12/10/2026 (LOCAL — aguarda migration 098)

- **MELHORIA do Pedido 3 — imagens de REFERÊNCIA (estilo AUTOIMAGEM).**
  Nova tabela `artes_referencias` + CRUD em
  `/api/marketing/artes/referencias` (PNG/JPG/WEBP até 2,5MB). Cada
  imagem vira um marker `{{slug}}` citável no campo Observações:
  `montarPartesImagem` posiciona a imagem no ponto exato do prompt e o
  Gemini (`gemini-imagem`) agora aceita `partes` (texto+inlineData).
  Tela: seção "Imagens de referência" com upload, clique no marker para
  inserir no Observações e exclusão. Ativas e não citadas vão na frente
  do pedido (comportamento AUTOIMAGEM). Testes: gerar-prompt (4 novos),
  gemini-imagem (1 novo), rota referências (4 novos), rota artes (1
  novo) — 521 no total.

## 1.8.18 — 12/10/2026

- **Docs:** Pedido 3 publicado (`a68c8d9`) — plano dos 3 pedidos,
  CHANGELOG e HANDOFF marcados como CONCLUÍDOS (testes reais ao vivo:
  geração Gemini + disparo com imagem).

## 1.8.17 — 12/10/2026 (PUBLICADO — 097 aplicada + chave Gemini na Vercel)

- **PEDIDO 3 — Criar Artes (MARKETING).** Tela
  `/marketing/artes` + item "Criar Artes" no grupo Marketing do menu:
  assistente guiado (tipo de post → assunto/texto/estilo → prévia do
  "grande prompt") → Gemini Nano Banana gera a imagem → galeria com
  Baixar/Excluir e **Disparar** (vai para `/disparo?arte=` com a
  imagem já carregada + banner de passo a passo). Rota
  `/api/marketing/artes` (GET/POST/DELETE, maxDuration 60); prompt em
  `lib/marketing/gerar-prompt` e receita do AUTOIMAGEM em
  `lib/marketing/gemini-imagem` (GEMINI_API_KEY só no ambiente da
  Vercel). Migration `097_artes.sql` (tabela `artes`). Supabase fake
  ganhou `delete()` + `getPublicUrl`. Testes: gerar-prompt,
  gemini-imagem, rota artes.


- **PEDIDO 2 — Base de Conhecimento do Vendedor.**
  - `base_conhecimento` ganha `vendedor_id` (NULL = global, UUID = base
    de um vendedor) — migration `096_base_vendedor_cursos.sql`;
  - a IA do atendimento agora carrega a base filtrada pelo VENDEDOR
    dono da conversa (globais + as dele, nunca a de terceiros) —
    `filtrarBasePorVendedor` + `carregarBaseConhecimento(supabase,
    vendedorId)` + `responderComBase({ vendedorId })`, com o dono lido
    no `executarAutomacao`;
  - Configurações → Base: select "Dono da entrada" (Global/vendedor) e
    badge na lista;
  - nova tabela `base_cursos` (cursos do SINERGIA: nome, URL, público)
    com CRUD na mesma tela;
  - nova tela **"Minha Base"** no menu (`/minha-base`): entradas
    globais + as do vendedor (somente leitura) e botões dos cursos que
    abrem a plataforma do SINERGIA.
  Testes: `filtrarBasePorVendedor` (4), `ai-assistant-vendedor` (4),
  `resposta-automatica` +1 → 490 no total; tsc/build/unittest verdes.

- **PEDIDO 1 — Dashboard "Potencial de Vendas".** Nova tela no menu
  (ícone TrendingUp) `/potencial-vendas` + rota
  `/api/dashboard/potencial-vendas` + lib pura
  `lib/dashboard/potencial.ts`. Venda confirmada = `oportunidades
  .resultado = 'sucesso'` (janela por `updated_at`, ?dias=30/90/180);
  agrupa por vendedor com mix por PRODUTO (o que ele vendeu mais) e
  destaca o produto líder para a gestão direcionar demanda. Perfil Fase 4
  no servidor: vendedor vê só o dele. Sem migration (colunas já
  existiam). Testes: `lib/dashboard/potencial.test.ts` (6) +
  `route.test.ts` (5).



- **IA de conta V2: analisa FOTO e PDF do cliente (visão MIMO).** A conta
  pode chegar como imagem ou arquivo no WhatsApp — antes só texto era
  analisado. Como ficou: foto → a `mimo-v2.6-flash` lê a imagem (entrada
  multimodal, data URL até 40MB); PDF → texto extraído localmente
  (`pdf2json`, mesma base do módulo RECIEE) e passado ao mesmo extrator.
  Legenda da mídia entra no contexto; áudio/vídeo/figurinha são ignorados.
  Teto de 60s por mídia; falha de download/leitura vira `erro` (nunca
  derruba a conversa) e o cron de conferência sinaliza. Gatilho novo no
  webhook WAHA (mídia chega como `midia` em `executarAutomacao`).
  Testes: `lib/ia-provider.test.ts` (chamarModeloVision),
  `lib/ia/classificar-conta.test.ts` (mídia),
  `lib/ia/identificar-oportunidade.test.ts` (foto/PDF),
  `lib/atendimentos/resposta-automatica.test.ts` (gatilho de mídia).

## 1.8.13 — 06/10/2026

- **IA identifica oportunidades da CONTA (MIMO + regras).** A cada
  mensagem de cliente que fala de conta/fatura/energia, a MIMO extrai da
  conversa o valor da conta e o Grupo A/B, e o **código** aplica a regra
  aprovada: valor > R$ 5.000 → **RECIEE** (prioridade); Grupo B até 5K
  → **GD**; fora isso, nada é criado. Cria a oportunidade no funil
  (etapa "recebeu_conta") com produto, cliente, vendedor e atendimento
  vinculados e o motivo na descrição. Pré-filtro barato (sem palavra de
  conta não há chamada de IA), dedup por atendimento, teto de 20s na
  chamada e falha nunca derruba a resposta da conversa.
  Testes: `lib/ia/classificar-conta.test.ts`,
  `lib/ia/identificar-oportunidade.test.ts` e
  `lib/atendimentos/resposta-automatica.test.ts` (gatilho).

- **Dashboard — Fase 4: um dashboard por PERFIL (filtro no servidor).**
  `GET /api/dashboard/tempo-resposta` agora exige sessão e filtra pelo
  cargo: **admin/diretor/gerente** = visão completa (vendedores, times,
  produtos); **vendedor** = só os atendimentos e oportunidades dele, com
  títulos "Seu tempo para responder" e sem os rankings de terceiros.
  Resposta traz `perfil` (cargo). Quando existirem equipes reais
  (`profiles.equipe_id`), o gerente passa a filtrar pelo seu time.

## 1.8.11 — 06/10/2026 (local, aguarda SQL 095)

- **Dashboard — Fase 3: dimensão PRODUTO.** Card "Qual produto responde e
  vende melhor": tempo de 1ª resposta + oportunidades + vendas (R$) por
  produto (`lib/dashboard/produtos-dim` + `porProduto` na rota).
- **Oportunidade ganha `produto_id`** (migration **095**): select de
  Produto no modal de NOVA oportunidade e no card de detalhes (salva na
  hora); POST/PATCH da rota aceitam o campo.
- **Cadastro de produtos:** POST/PATCH em `/api/produtos` (só admin)
  + botão "Novo produto" e lápis de edição na página /produtos.

## 1.8.10 — 06/10/2026

- **Dashboard — UX dos tempos (feedback do João "não ficou intuitivo"):**
  tempos agora em **horas/dias** ("19h", "5 dias 10h", "na hora" em vez
  de minutos), títulos explicando o que é ("Tempo médio para responder",
  "Quem demora mais para responder"), linhas de ajuda, rótulo "Período",
  vendedor sem perfil vira "Conta sem cadastro" (antes mostrava o id) e
  "Sem time" ganha o número da conversa — ex. "Sem time (STK-2)".
  Nova lib `lib/dashboard/formatar`.

## 1.8.9 — 06/10/2026

- **Dashboard — Fase 2:** rankings de tempo de resposta **por VENDEDOR**
  (do mais lento ao mais rápido: média, nº de respostas e pior caso) e
  **por TIME** (Time Lobo/Águia pelo número STK da conversa),
  com **filtro de período** (7 / 30 / 90 dias). Ranknings em
  `lib/dashboard/rankings`; rota `?dias=`.

## 1.8.8 — 06/10/2026

- **Dashboard — Fase 1 do plano novo (`docs/plano-dashboard-fases.md`):**
  card **Tempo de Resposta (1ª resposta)** com média geral e de hoje,
  contada SÓ em horário comercial (seg–sex 08:00–18:00, Brasília).
  Cálculo em `lib/dashboard/tempo-resposta` + rota
  `GET /api/dashboard/tempo-resposta` (período 30 dias).
- **Dados de teste criados:** equipes **Time Lobo** (STK-1) e
  **Time Águia** (STK-3 — mapa em `lib/dashboard/equipes`); produtos
  **GD, RECIEE, ELETROPOSTO, SIGMA SOLAR** na tabela `produtos`.

## 1.8.7 — 06/10/2026

- **Dropdown STATUS (Novo + Editar):** opções agora são
  **LEAD / PROSPECT / CLIENTE / CAPTADOR** (`lib/clientes/status-cliente`).
  Status antigo já salvo (ativo/churn/inativo) aparece como opção extra
  "(antigo)" — nenhum dado perdido, filtros antigos continuam valendo.

## 1.8.6 — 06/10/2026

- **Tela CLIENTES — ajustes pedidos pelo João:**
  - IE removido do PJ (RG continua para Pessoa Física);
  - campos novos abaixo de Data de Abertura: **Nome do Contato, Cargo,
    CPF do Proprietário, Data de Nascimento** (colunas novas);
  - "Endereço" → **"Endereço da Empresa"** (Editar e Novo);
  - "Bandeira" removido dos dois formulários (coluna fica no banco);
  - **"Tem Usina Solar"** (era "Possui geração própria"): ao marcar SIM a
    tela de marcação da usina abre sozinha (CRI, nome, kWp → `clientes.usina`);
  - **LOG DE CRIAÇÃO/EDIÇÃO de clientes — novo recurso, só admin:**
    tabela `cliente_auditoria`, registro nas rotas POST/PUT de
    `/api/clientes`, leitura `GET /api/clientes/log` (401/403) e tela
    **Log de Alterações** no menu (item só aparece para cargo admin).
- **Consertos de save descobertos no caminho (TDD):**
  - Editar Cliente NÃO salvava: mandava `nome_completo` (coluna inexistente,
    PGRST204) — agora salva via `PUT /api/clientes/[id]` com
    `montarPayloadCliente` (colunas reais) e grava o log;
  - Novo Cliente jogava fora endereço/energia/consumo/origem/rg — payload
    agora é o formulário inteiro mapeado pela mesma função.
- **Migration `094_clientes_contato_log.sql` — PRECISA ser aplicada no SQL
  Editor** (4 colunas de contato/proprietário + tipo_cliente/classificacao
  que a UI já usava + tabela `cliente_auditoria` com RLS de admin).
- Testes: +27 (payload, auditoria, 3 rotas, form da usina, tela do log).

## 1.8.5 — 06/10/2026

- **Atendimento — cortesia fora do horário agora é ENVIADA** (passo 1,
  adiado em 03/10): o engine do chatbot compunha "Nosso time comercial está
  fora do horário... Retornaremos em breve! 😊" mas `integrarChatbot` só
  lia `action` — ninguém mandava a mensagem e o cliente ficava no silêncio
  (IA bloqueada pela precedência do chatbot). O branch `fora_horario` agora
  envia via `enviarMensagem` antes de retornar. TDD (`engine-horario.test`):
  RED do silêncio + controle em horário comercial.

## 1.8.4 — 05/10/2026

- **Botão REENVIAR as falhas do disparo em massa**: nova rota
  `POST /api/bulk/campaigns/reenviar` (TDD, 5 testes) — lê `disparo_logs`,
  enfileira só quem falhou E nunca recebeu nada (parcial fica de fora, sem
  mensagem duplicada), copia o registro original inteiro (fluxo, imagens,
  instância, intervalos) com `status=running` e contadores zerados; robô sem
  alteração. Na tela de Marketing > Campanhas: botão ↻ âmbar ao lado de
  "Logs" quando `failed > 0`, com confirmação antes de agitar.

## 1.8.3 — 05/10/2026

- **Disparo em massa: 49 de 50 falhando com `no LID found for
  <n>@[REDACTED_DOMAIN]`** — bug do motor **GOWS** do WAHA 2026.9.1
  (WAHA #1714/#2094/#2214, abertos): o WhatsApp não resolve PN → LID no
  envio. Causa prática brasileira (wuzapi #243): o **9 extra na 5ª posição**
  — o servidor só resolve uma das grafias. `variantes_chat_id()` monta a
  variante (55+DDD+9XXXXXXXX ⇄ 55+DDD+8XXXXXXXX) e `enviar_passo()`
  repete UMA vez nela quando o erro é de LID; a variante que funcionar é
  adotada nos próximos passos do contato. Erros que não são de LID não
  ganham retry (só duplicaria chamada). 7 testes novos (159 no worker).

## 1.8.2 — 03/10/2026

Correções de UX das telas de Atendimento/Fila AXS/Clientes (4 bugs
apontados pelo João, TDD em todos):

### Atendimento > Propostas: GD era cadastro com nome de proposta
- "Salvar Proposta GD" só gravava 5 campos no cliente (nada ia pra fila nem
  pra AXS) e o input "Consumo mensal (kWh)" era pedido e DESCARTADO (nem ia
  no corpo do PUT) → renomeado para **"Salvar cadastro GD"**, campo morto
  removido e ganhou o botão **"Criar proposta na AXS →"** levando para
  `/clientes/{id}/axs-novo` (o único form que enfileira de verdade)
- Aba extraída de `painel-contato.tsx` (1335 → 1092 linhas) para
  `components/features/atendimento/aba-propostas.tsx` + `propostas-opcoes.ts`
- **Infra nova de teste de componente:** `@testing-library/react` +
  `@testing-library/dom` + `jsdom` (primeiros testes de UI renderizada)

### Passo 9 do guia: fila "Criada na AXS" agora mostra a mensalidade
- Causa-raiz: a AXS devolve `mensalidade_axs` no `criar/card` e o worker
  DERRUBAVA (só guardava o idCard) — tabela da fila sem coluna e tela sem
  campo
- `worker/fila_axs.py`: `_para_valor` + `_salvar_mensalidade` grava em
  `clientes.axs_mensalidade` (coluna da migration 077 — **sem migration
  nova**); dep opcional, testes antigos seguem verdes
- `GET /api/axs/fila` junta a mensalidade no item; tela `/fila-axs` mostra
  **"card 1452248820 · R$ 767,88"** ao lado do status

### Ficha do cliente vazia ("Sem nome / Sem CPF/CNPJ")
- Causa-raiz: a view `v_unified_clientes` (083) expõe `nome`/`cpf_cnpj`; a
  ficha lia `nome_razao_social`/`cnpj_cpf` e como a view era o 1º SELECT
  (e SEMPRE acha), o fallback `clientes` nunca rodava → tudo vazio na tela
  mesmo com dado no banco (ex.: CROPS AGROBUSINESS LTDA, CNPJ
  40173720000173 — que nem está em `clientes`, veio da RECIEE)
- `lib/clientes/normalizar.ts`: casa as duas grafias preservando o que já
  existe; ficha, **edição** (que perdia o CPF: lia `cpf_cnpj` na tabela que
  só tem `cnpj_cpf`) e **formulário AXS novo** agora buscam `clientes`
  PRIMEIRO (dado completo: endereço, UC, classe…) e a view como fallback —
  bônus: endereço/UC agora pré-preenchem o axs-novo
- Teste de produção: João Pedro (56c486ab) tem linha completa em
  `clientes`; CROPS cai na view com nome+CNPJ corretos

**Gates: 354 vitest + 147 unittest + `tsc --noEmit` limpo.**
Worker publicado em /app/stk-worker (pid 387030, sha256 conferido).

## 1.8.1 — 03/10/2026

### IA do atendimento passa à MIMO (Opção A) — fim do `erro_ia`
- Em produção toda pergunta caía no fallback "Deixa comigo..." com motivo
  `erro_ia`: a chamada ao Gemini falhava (chave ausente/inválida na Vercel)
- Novo provedor único `lib/ia-provider.ts`: MIMO (`mimo-v2.6-flash`, API
  OpenAI-compatível) por padrão, Gemini mantido como legado (`IA_PROVIDER`)
- Usado pela base de conhecimento (`ai-assistant`) E pela interpretação de
  resposta livre do chatbot (`engine.interpretarRespostaIA` — antes travava
  em `!GEMINI_API_KEY` e caía sempre no match simples)
- Guardrail intacto: falha do modelo continua `erro_ia` → encaminha com registro;
  `[[ENCAMINHAR]]` e `base_vazia` não mudaram
- TDD: 17 testes novos (RED → GREEN), gates **322 vitest + 138 unittest + tsc limpo**
- **Em produção no mesmo dia:** `Prazo` (03:26:49) → resposta da base em **9s**,
  0 notificações de `erro_ia` (toggle IA ligado e desligado pelo João às 03:26/03:27)

### Imagem do disparo deixa de virar arquivo de 422 KB
- Causa provada: a tela gravava o passo com prefixo `data:image/jpeg;base64,`
  (sem subir pro Storage) e o robô mandava isso pra WAHA → decodificação
  corrompida: `fileLength` **432548** (mágica `75ab5a8a`, ≠ JPEG) vs **432533**
  limpo — o WhatsApp mostrava quadro cinza com o ícone de ⬇ 422 KB
- Robô: `limpar_base64()` antes de enviar + `eh_contato()` não envia mais pra
  lixo da lista (`STK-3` virava chatId `553@c.us` e a WAHA dava timeout)
- Tela: `lib/marketing/disparo-fluxo.ts` — imagem **sobe pro Storage** e o passo
  vira `{type:'image', url, mimetype}`; `montarNumbers()` tira a instância da
  lista em massa/avulso (só o remarketing estava corrigido)
- Rota `/api/bulk/campaigns`: o passo agora guarda **também** o `mimetype`
- TDD: 9 testes do worker + 15 vitest novos; **gates: 337 vitest + 147 unittest + tsc**
- **Prova em produção (03:38):** imagem enviada pelo caminho corrigido leu
  `fileLength=432533` (= limpa) na API do WAHA — 1 mensagem de teste ao nº do João

### IA responde o que está na base (prompt + palavras-chave)
- Na conversa real o "Prazo" virou uma PERGUNTA ("qual serviço?") em vez de
  "Vai chegar amanhã" — 2 defeitos: as `palavras_chave` NÃO iam pro prompt e
  as diretrizes de "puxar assunto" não tinham regra de prioridade
- `montarBlocoConhecimento` agora envia as palavras-chave (`- teste
  viabilidade [prazo]: Vai chegar amanhã`)
- Regra **PRIORIDADE** no prompt: casou com a entrada → responde DIRETO, sem
  perguntar esclarecimento (D7 "puxar assunto" continua, só depois)
- Temperature 0.7 → **0.4** (resposta fiel, sem improviso)
- TDD: 4 testes novos; **gates: 341 vitest + tsc limpo**
- **Prova ao vivo:** mesmo caso real ("Prazo" + entrada do João) →
  *"Para o teste de viabilidade, a previsão é que chegue amanhã..."* — conteúdo
  da base, sem perguntar (0 chamadas de encaminhamento)

---

## 1.8.0 — 30/09/2026

### Sincronização de mensagens (fora da lista de testes)
- Mensagem enviada por nós (`fromMe`) era arquivada **na conversa errada**: o parser lia os
  campos de remetente (somos nós) em vez de `RecipientAlt` → chat `@lid` apontava para o nosso
  número; 10 mensagens paravam no atendimento do nosso número
- Cartão de contato (vCard) e localização eram descartados como "mensagem vazia"
- Conserto em TDD (5 testes RED → GREEN), commits `4555880` e `66e2d84`
- Histórico reparado: 10 mensagens realocadas + 7 repostas por replay do payload real;
  auditoria final por ID = 0 mensagens fora do CRM

### Badge de número conectado (🔗 STK-x)
- Nunca aparecia: a rota entregava `status` mapeado sem `state` e o helper só aceitava
  `WORKING/STARTED`. Conserto em TDD (`b6f713d`), verificada na lista e no cabeçalho do chat

### Documento de proposta em PDF (Fase 6 / C4)
- Botão "Gerar/Baixar proposta" na pasta do cliente e no modal da oportunidade
- Gatilho automático quando a etapa vira **Contrato Enviado**
- Gravado no Storage privado e registrado na tabela `propostas`

### Robô de fila AXS (Fase 3 / C01)
- Card criado pelo robô pelo caminho oficial (fila → `criar/card`): `1452248820`
- Payload da fila precisa ser **plano** (topo), senão o gerador responde `ERROR #5034`
- Scripts `/app/start-worker.sh` e `/app/stop-worker.sh` (modo ensaio/dry-run)

### Testes de liberação
- 34 itens aprovados + 3 de performance; 0 reprovados após conserto de B11
- Controle vivo: `docs/TESTES-SISTEMA.MD` · HANDOFF · parecer ARP em `docs/PARECER-ARP-28-09-2026.md`
- Entregas em Word: `RESUMO-SIMPLES-como-usar-29-09-2026.docx` (guia de leigo) e
  `relatorio-testes-26-29-set-2026.docx` (relatório técnico)

---

## 1.7.0 — 20/09/2026

### Busca de Contatos WhatsApp via Evolution API
- Modal de busca de contatos com debounce (300ms)
- Verificação de números no WhatsApp
- Criação de atendimento direto da busca
- API routes: `/api/whatsapp/contacts`, `/api/whatsapp/check-number`
- Fallback automático de URL da Evolution API
- Rota de debug `/api/whatsapp/debug`

### Bug Fixes
- EVOLUTION_API_KEY corrompida no build Vercel
- EVOLUTION_INSTANCE estava 'minha-conexao' (inexistente), corrigido para STK-1

### Arquivos modificados
- `lib/evolution-api.ts`
- `app/(dashboard)/atendimento/page.tsx`

### Arquivos criados
- `app/api/whatsapp/contacts/route.ts`
- `app/api/whatsapp/check-number/route.ts`
- `app/api/whatsapp/debug/route.ts`
- `components/features/atendimento/buscar-contatos-whatsapp.tsx`

---

## 1.6.0 — 19/09/2026

### Redesign Cards Kanban Oportunidades + Modal Tema Escuro
- Cards do Kanban redesenhados com gradiente e borda lateral colorida por coluna
- Cards: cliente em destaque (fonte maior/bold), valor em badge verde, tags de origem/prioridade/data
- Cards: botão deletar com backdrop-blur no hover, drag feedback visual melhorado
- Modal de detalhes completamente em tema escuro (bg-[#0c1426])
- Modal: etapa real do funil no badge (substituiu 'Tipo: Pedido | A Fazer')
- Modal: cliente com avatar, valor da venda em destaque, origem como badge colorido
- Modal: todos inputs/selects/botões em tema escuro consistente
- Botão de fechar (X) visível em tema escuro
- Arquivos modificados: kanban-oportunidades.tsx, modal-detalhes-oportunidade.tsx, dialog.tsx

---

## 1.5.0 — 19/09/2026

### Separadores de Date no Chat
- Adicionado separadores de data entre mensagens de dias diferentes
- Labels: "Hoje", "Ontem", ou data completa (dd/mm/aaaa)
- Visual estilo WhatsApp: pill centralizado com fundo sutil
- Funções `formatarDataSeparador` e `diasDiferentes`

---

## 1.4.0 — 11/09/2026

### Descriptografia de Mídia WhatsApp
- Endpoint `/api/media-download` para descriptografar áudio/imagem
- Player de áudio funcional no chat
- Timestamp original do WhatsApp (messageTimestamp)

### Worker de Disparo
- Worker Python via Supervisor no VPS
- Múltiplas instâncias WhatsApp (STK-1, STK-2, ROMA_2)
- Campos de timing configuráveis

### Segurança
- Validação X-Webhook-Secret
- Rate limiting (180 req/min global)
- LID Resolver para mapear @lid → telefone

---

## 1.3.0 — 06/09/2026

### Chatbot: Gatilho Disparo
- Campo `gatilho` no chatbot_flows: 'todos' | 'disparo'
- Tabela `chatbot_gatilho_numeros`
- Detecção de palavras de parada
- Bloqueio de reativação por 24h

---

## 1.2.0 — 05/09/2026

### Chatbot Inteligente
- Engine de state machine (675 linhas)
- Integração com Gemini 2.5 Flash
- Fluxo pré-configurado: Sustentalski (14 etapas)
- Classificação de leads por scoring (A/B/C/D)

---

## 1.1.0 — 04/09/2026

### Módulo RECIEE
- Upload de faturas PDF com parsing automático
- Análise de cobranças indevidas
- Gerar relatório Excel e proposta comercial PDF

---

## 1.0.0 — 03/09/2026

### Lançamento Inicial
- 4 perfis (CRM, Marketing, Pós-Vendas, Admin)
- Sidebar dinâmica por perfil
- Chat WhatsApp com Evolution API
- Kanban de tarefas
- Gestão de clientes
- Dashboard com métricas reais
