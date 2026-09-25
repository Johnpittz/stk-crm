# Plano de Migração — WhatsApp (Evolution API → WAHA) — STK-CRM

> **Escopo:** migrar os módulos **ATENDIMENTO** (chat) e **DISPARO** (campanhas em massa) do STK-CRM
> de Evolution API para **WAHA**, reaproveitando a migração já validada em produção no CRM-ROMA.
> **FORA do escopo:** conectar os números (escaneamento de QR) — quem fará isso é **outra pessoa**
> (nossa parte é deixar tudo pronto + runbook de instruções).
> **Restrição nº 1:** **NENHUMA conversa de produção pode se perder.** As tabelas `atendimentos` e
> `atendimento_mensagens` não podem ser alteradas de forma destrutiva — a migração é só de código.
> **Método:** TDD (RED → GREEN → REFACTOR), como combinado.

---

## 1. Por que este plano é seguro (premissa central)

As conversas do STK-CRM **não vivem na Evolution API** — elas vivem no Supabase:

```
tabela atendimentos            ← quem conversa com quem (telefone, vendedor, instancia)
tabela atendimento_mensagens   ← todas as bolhas do chat (conteudo, url_midia, whatsapp_message_id)
bucket "media" (Storage)       ← mídias já salvas no Supabase no momento do recebimento
```

A Evolution API é apenas o **canal de envio/recebimento**. Trocar o canal não mexe nas conversas:
- Nenhum `DELETE`/`DROP`/`ALTER` destrutivo nas tabelas de conversa.
- Histórico antigo continua aparecendo normalmente (as mídias antigas já estão no Storage).
- O webhook novo escreve **nas mesmas tabelas**, com a mesma lógica de dedup (`whatsapp_message_id`).
- A Evolution fica configurada (código `@deprecated`, não apagado) como **rollback por 24–48h**.

**Backup pré-cutover:** exportar as tabelas `atendimentos`, `atendimento_mensagens` e `chatbot_sessions`
pelo SQL Editor do Supabase (ou `pg_dump`) antes de trocar o canal. Barato e elimina o risco.

---

## 2. O que vem pronto do CRM-ROMA (não vamos reinventar)

O CRM-ROMA passou por esta migração exata e está validado em produção (22–23/09/2026, 70/70 testes verdes).
Do repositório `Johnpittz/crm-roma` (clone local `/root/crm-roma-clone`) copiamos/adaptamos:

| Peça | Arquivo no CRM-ROMA | O que faz |
|---|---|---|
| Adapter WAHA | `lib/waha.ts` (+ `lib/waha.test.ts`) | enviarTexto, enviarMidia, enviarAudio, enviarLido, verificarSessao, checkNumbers, findContacts, resolverLid, montarUrlArquivo, resolverUrlMidia |
| Parser do webhook | `lib/waha-webhook.ts` (+ testes + `lib/__fixtures__/`) | parse message.any/message.ack/session.status, dedup, checkmarks, tipo de mídia |
| Formatação | `lib/telefone.ts` (+ testes) | formatarTelefone unificado |
| Webhook | `app/api/webhooks/waha/route.ts` | template do fluxo completo (adaptar ao STK, ver §4) |
| Runbook de números | `docs/runbook-waha-numeros.md` | **exatamente o material para a pessoa que vai escanear os QR** |
| Lições (BUG-1..7) | `docs/HANDOFF-MIGRACAO-WAHA.md` §5 | armadilhas do payload real do GOWS que já custaram dias de trabalho |

**Armadilhas já descobertas lá (vão nos poupar tempo — payload real ≠ documentação):**
1. JIDs chegam como `@lid` → resolver para número real antes de gravar.
2. Nome do contato vem `pushname` (minúsculo) → aceitar variações + fallback `GET /api/{session}/contacts/{id}`.
3. Webhook deve assinar **`message.any`** (não `message`) — senão mensagens enviadas do celular somem.
4. `from` = o CHAT sempre; `to` = eu mesmo (`fromMe` marca direção) — senão grupo vira "cliente".
5. `media.url` do WAHA vem como `http://localhost:3000/...` → normalizar para URL pública (resolverUrlMidia).
6. Arquivos > ~3,3 MB estouram o limite de 4,5 MB da Vercel em base64 → fluxo de upload assinado + `mediaUrl`.
7. RLS bloqueia envio de quem não é dono do atendimento → escrever mensagens via service role (mantendo auth).

---

## 3. Decisões de projeto (Fase 0 — travar antes de código)

| # | Decisão | Resposta |
|---|---|---|
| D1 | **Nomes das sessões WAHA** | **`STK-1`, `STK-2`, `STK-3`** (decisão do usuário em 24/09: a 3ª sessão que hoje se chama `ROMA_2` passa a ser **`STK-3`**). Sessão `ROMA_1` já existe, do CRM-ROMA — não mexe. ⚠️ Consequência: como o dado legado usa `ROMA_2`, a migração de **rótulo** (UPDATE de `instancia='ROMA_2'` → `'STK-3'` nas linhas de `atendimentos`, `bulk_campaigns`, `chatbot_flows`, `chatbot_sessions` + ajuste dos defaults no código: fallback `'ROMA_2'` do chatbot engine/webhook e `DEFAULT 'ROMA_2'` da migration 077) **SÓ PODE RODAR NO CUTOVER (F8)**, junto com a troca de canal — enquanto a Evolution estiver ativa, o webhook chega com `instance='ROMA_2'` e a busca de atendimento por `telefone + instancia` deixaria de casar, criando atendimentos duplicados. É mudança de etiqueta de coluna de texto — **nenhum conteúdo de conversa é tocado**. |
| D2 | Onde roda o WAHA | No mesmo WAHA que já está na VPS (porta 3000), que hoje só tem a sessão `ROMA_1`. Basta criar as sessões novas — sem instalar nada. |
| D3 | URL do webhook | `https://stk-crm-amber-delta.vercel.app/api/webhooks/waha` (domínio confirmado). Eventos: `message.any`, `message.ack`, `session.status`. |
| D4 | Autenticação do webhook | Adaptar o `validateWebhookSecret` atual → token via query `?token=` (`WAHA_WEBHOOK_TOKEN`), padrão validado no CRM-ROMA. |
| D5 | Relação Evolution/WAHA | **Cutover sem paralelo**: não dá para o mesmo número estar nos dois canais ao mesmo tempo. Evolution fica ligada até o momento da troca; depois, disponível como rollback por 48h. |
| D6 | Sync de mensagens do celular | Com `message.any`, mensagens enviadas **do celular** já chegam pelo webhook → os endpoints `sync`/`sync-from-evolution` são aposentados (mantidos @deprecated no rollback). Janela entre parar Evolution e conectar WAHA é coberta por **backfill** (§7, passo 5). |
| D7 | Checkmarks (✓/✓✓/azul) | Hoje o STK **não tem** checkmarks (webhook só processa `messages.upsert`). Incluir como fase opcional barata (migration `ack_status` + `message.ack`), mesmo caminho do CRM-ROMA. |
| D8 | Testes | Instalar **vitest** no STK-CRM (hoje não existe nenhum framework) e portar os testes do `lib/waha.ts`/`waha-webhook.ts`/`telefone.ts` como fundação. |

---

## 4. Mapa de impacto (o que muda, arquivo por arquivo)

### 4.1 ATENDIMENTO

**Envio (trocar Evolution → WAHA):**
| Arquivo atual | O que faz hoje | Migração |
|---|---|---|
| `lib/evolution-api.ts` (496 ln) | adapter completo da Evolution | vira legado `@deprecated`; novo `lib/waha.ts` (port do CRM-ROMA, mantendo assinaturas parecidas) |
| `app/api/send/text/route.ts` | envio de texto | import → `lib/waha.ts` |
| `app/api/send/media/route.ts` | envio de mídia (base64) | import → `lib/waha.ts` + fluxo de **upload assinado** p/ arquivos grandes (lição 6) |
| `app/api/atendimentos/mensagens/route.ts` | POST da bolha no chat + envio | import → `lib/waha.ts`; gravação via **service role** (lição 7) |
| `lib/chatbot/engine.ts` (função `enviarMensagem`, ln 243) | fetch **inline** da Evolution (nem usa o adapter!) | trocar por `lib/waha.ts` — ponto crítico, é ele que responde os leads 24h |
| webhook `route.ts` ln ~466 | auto-resposta IA pelo webhook | idem |

**Recebimento:**
| Arquivo atual | O que faz hoje | Migração |
|---|---|---|
| `app/api/webhooks/whatsapp/route.ts` (747 ln) | webhook Evolution: valida secret, rate limit, extrai dados, ignora grupos, sobe mídia no Storage, busca/cria atendimento por telefone+instancia, roteamento (`lib/roteamento`), **integração chatbot**, auto-resposta IA, dedup | **novo** `app/api/webhooks/waha/route.ts`: mesmo fluxo STK (cliente, atendimento, roteamento, chatbot, IA) trocando só o **parser** pelo `lib/waha-webhook.ts` + lições 1–5. Rota antiga fica intacta p/ rollback. |
| `app/api/media-download/route.ts` | decrypt de mídia Evolution | manter como **legado** (mídias antigas), mesmo destino do CRM-ROMA |

**Consultas (contatos/status/instâncias):**
| Arquivo | Migração |
|---|---|
| `app/api/whatsapp/contacts/route.ts` | → WAHA `GET /api/contacts/all` (formato de resposta preservado p/ o modal `buscar-contatos-whatsapp.tsx` não mudar) |
| `app/api/whatsapp/check-number/route.ts` | → WAHA `GET /api/contacts/check-exists` |
| `app/api/whatsapp/status/route.ts` | → WAHA `GET /api/sessions/{name}` |
| `app/api/instances/route.ts` | → WAHA `GET /api/sessions` (mesmo formato de resposta p/ seletor do header/UI) |
| `app/api/atendimentos/sync*` | aposentar (D6) |

**Frontend:** nada obrigatório — `chat-inline`/`lista-atendimentos` não conhecem a Evolution (falam com as APIs).
Só a fase opcional de checkmarks mexe no chat.

### 4.2 DISPARO

| Peça | Hoje | Migração |
|---|---|---|
| `app/api/bulk/send/route.ts` | só marca campanha `running` | **não muda** |
| Worker `/root/disparo_worker.py` (VPS host, via Supervisor) | poll Supabase a cada 5s + envio **direto na Evolution** (`sendText`/`sendMedia` por instância) | trocar as chamadas HTTP de envio para o WAHA (`POST /api/sendText` com `chatId: 55...@c.us`, `session` da campanha) — lógica de cadência, fluxo de mensagens e variáveis `{{nome}}` ficam iguais. ⚠️ Arquivo está no **host** da VPS e fora do Git → criar cópia versionada em `worker/disparo_worker.py` no repo ao editar. |
| `bulk_campaigns.instancia` (ROMA_2/STK-1/STK-2) | nomes Evolution | sem mudança (D1) |

---

## 5. Fases (ordem de execução, cada uma com teste primeiro)

### F0 — Decisões travadas (sem código)
- Validar D1–D8 com o usuário; confirmar domínio de produção do Vercel (webhook URL); confirmar que quem escaneia os QR é outra pessoa.

### F1 — Fundação de testes
- `npm i -D vitest` + script `"test": "vitest run"` + `vitest.config.ts` (transform JSX).
- Portar de lá: `lib/telefone.test.ts`, `lib/waha.test.ts`, `lib/waha-webhook.test.ts`, fixtures.
- **Aceite:** `npm test` rodando (RED inicial na porta errada é esperado).

### F2 — Infra WAHA (fora do repo)
- Criar sessões `STK-1`, `STK-2`, `ROMA_2` no WAHA da VPS (engine GOWS, ao lado da `ROMA_1`).
- **QR fica para a outra pessoa** — entregamos o runbook (`docs/runbook-waha-numeros.md` adaptado).
- **Aceite:** sessões no ar (mesmo que sem QR ainda) + `WAHA_API_KEY` nas env vars do Vercel do STK.

### F3 — `lib/waha.ts` (TDD)
- Port + adaptar: parâmetro `instancia` → `session`, env vars `WAHA_API_URL`/`WAHA_API_KEY`.
- **Aceite:** testes verdes; `enviarTexto` entrega em número de teste via curl.

### F4 — Webhook `/api/webhooks/waha` (TDD no parser)
- Port do parser + fixture; rota com o fluxo STK completo (dedup → mídia → cliente → atendimento → roteamento → chatbot → IA).
- Mapeamento: `payload.session` → coluna `instancia` (D1 faz ser igual ao nome).
- **Aceite:** replay de fixture cria atendimento+mensagem reais; replay 2º → `dedup_skipped`; grupo (`@g.us`) → `ignored_group`.

### F5 — Troca dos envios (TDD)
- `send/text`, `send/media` (+upload assinado p/ >3 MB), `atendimentos/mensagens`, **chatbot engine**, auto-resposta do webhook.
- **Aceite:** texto, imagem, áudio, PDF saem do chat e chegam no WhatsApp real; bolha aparece no CRM.

### F6 — Contatos/status/instâncias
- 4 rotas de consulta + modal de busca funcionando sem alteração de UI.
- **Aceite:** checklist de `docs/busca-contatos-whatsapp.md` passando.

### F7 — Disparo via WAHA
- Adaptar `disparo_worker.py` (versão versionada no repo) e trocar no Supervisor.
- **Aceite:** campanha de teste entrega mensagens nos 3 números; logs `disparo_logs` ok.

### F8 — Cutover + backfill (dia da troca) — ver §7

### F9 — Opcional: checkmarks (migration `ack_status` + `message.ack`) — TDD mesmo caminho do CRM-ROMA

### F10 — Documentação e limpeza
- Handoff/PROGRESSO do STK, runbook do número para a outra pessoa, apagar legado Evolution **só 48h estáveis**.

---

## 6. Riscos e rollback

| Risco | Mitigação |
|---|---|
| Queda de conversas na janela da troca | §7 passo 5 (backfill via histórico WAHA) + dedup por `whatsapp_message_id` |
| Payload GOWS diferente da doc | fixtures reais + lições 1–5 do handoff (payload já foi auditado ao vivo lá) |
| Sessão cai / QR expira | evento `session.status` no webhook + runbook; backup do volume `sessions` do WAHA |
| Cutover quebra o envio | rollback: religar webhook Evolution (`/api/webhooks/whatsapp`) + env vars `EVOLUTION_*` — código antigo intacto |
| Worker do VPS não sobrevive à troca | F7 testada antes do cutover; se falhar, Evolution no worker continua disponível no rollback |
| Ban de número | volume igual ao de hoje (o mesmo número) — risco inalterado; manter cadência do disparo |

---

## 7. Cutover passo-a-passo (dia da troca)

1. **Backup:** dump de `atendimentos`, `atendimento_mensagens`, `chatbot_sessions`.
2. **Deploy:** código WAHA no ar (webhook novo vivo, ainda sem eventos — o webhook da sessão só aponta pra ele no passo 4).
3. **Env vars no Vercel (STK):** `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_SESSION` (default), `WAHA_WEBHOOK_TOKEN`. Manter `EVOLUTION_*`.
4. **Troca de canal:** desligar instâncias Evolution → criar/`start` sessões WAHA → registrar webhook
   `PUT /api/sessions/{nome}` apontando para `https://<prod>/api/webhooks/waha?token=…` com eventos
   `message.any`, `message.ack`, `session.status` → **outra pessoa escaneia os 3 QR** (runbook).
   *(Ordem importa: primeiro parar a Evolution, depois conectar o WAHA — o mesmo número não fica nos dois.)*
5. **Backfill (não perder a janela):** script que puxa `GET /api/{session}/chats/{chatId}/messages?limit=N`
   para os atendimentos ativos e insere só o que não existe (`whatsapp_message_id NOT IN`), fechando o
   intervalo entre o último webhook Evolution e a sessão WAHA ativa.
6. **Smoke E2E:** texto e mídia nos dois sentidos nos 3 números, chatbot respondendo, disparo de teste,
   mensagens enviadas **do celular** aparecendo (`message.any`).
7. **Confirmação de 0 perda:** conferir a conversa mais antiga e a mais recente de 3 atendimentos de produção.
8. **Rollback disponível por 48h** (Evolution intacta); depois F10 (apagar legado).

---

## 8. Definição de Pronto

1. Nenhum import ativo de `lib/evolution-api.ts` fora do caminho de rollback.
2. Atendimento (texto/mídia/áudio/grupos ignorados/chatbot/IA) e disparo funcionando via WAHA em produção.
3. `npm test` verdes (adapter + parser webhook + telefone) — TDD respeitado em cada fase.
4. Conversas antigas intactas e janela de cutover coberta por backfill (validado em E2E).
5. Runbook da conexão de números entregue à pessoa que vai escanear.
6. Handoff/docs do STK atualizados (PROGRESSO + este plano + runbook).

---

*Documento criado em 24/09/2026 — base: `crm-roma` (HANDOFF-MIGRACAO-WAHA + plano F0–F8) e auditoria do código STK-CRM.*
