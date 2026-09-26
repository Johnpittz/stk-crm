# Worker de Disparo WAHA (STK-CRM)

> Fase 7 do `docs/plano-migracao-waha.md`. Substitui o `/root/disparo_worker.py` (Evolution API)
> que roda na VPS via Supervisor.

## O que é

`disparo_worker_waha.py` — mesmo comportamento do worker original (documentado em `PROGRESSO.MD`,
Fase 12): polling de 5s no Supabase por campanhas `status='running'`, envio via WAHA
(`sendText`/`sendImage`) na sessão da campanha, fluxo de mensagens com delays, variáveis
`{{nome}}`/`{{telefone}}`, contadores `sent`/`failed`, logs em `disparo_logs`, retomada por
`offset = sent + failed`, suporte a `paused`. Somente stdlib Python (sem `pip`).

Testes: `python3 -m unittest test_disparo_worker` (12 casos, sem rede).

## Env vars obrigatórias

| Var | Valor (VPS) |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (mesma do Vercel) |
| `WAHA_API_URL` | `http://127.0.0.1:3000` na VPS / `http://172.16.1.1:3000` no container |
| `WAHA_API_KEY` | mesma do `WAHA_API_KEY` em `~/waha/.env` (host) |
| `DISPARO_POLL_SECONDS` | opcional, padrão `5` |

## Deploy na VPS (preferido — mesmo lugar do worker antigo)

```bash
# No host (hPanel → Web console ou SSH):
cp /caminho/disparo_worker_waha.py /root/disparo_worker_waha.py

# Novo arquivo de serviço do Supervisor:
cat > /etc/supervisor/conf.d/disparo_worker_waha.conf << 'EOF'
[program:disparo_worker_waha]
command=python3 /root/disparo_worker_waha.py
directory=/root
autostart=true
autorestart=true
stderr_logfile=/var/log/disparo_worker_waha.err.log
stdout_logfile=/var/log/disparo_worker_waha.out.log
environment=SUPABASE_URL="...",SUPABASE_SERVICE_ROLE_KEY="...",WAHA_API_URL="http://127.0.0.1:3000",WAHA_API_KEY="..."
EOF

supervisorctl reread && supervisorctl update
```

## ⚠️ Cutover obrigatório (Fase 8)

1. **PARAR o worker antigo ANTES de iniciar este**: `supervisorctl stop disparo_worker`
   — dois workers disputando a mesma `campaign_id` envia em dobro.
2. Só então `supervisorctl start disparo_worker_waha`.
3. Smoke: criar campanha com 1 número real, conferir `sent=1`, log `status='ok'` e a
   mensagem chegando no WhatsApp.

## Alternativa: rodar dentro do container (se o host não estiver acessível)

O container `john_hermes` alcança o WAHA (`http://172.16.1.1:3000`) e o Supabase. Para
sobreviver a restarts, o processo precisa ser religado na subida do container — usar o
`/app/start-services.sh` (blindagem já existente) ou um watchdog via cron do container.
**Mesmo assim, o worker ANTIGO na VPS precisa ser parado no cutover.**

## Diferença conhecida em relação ao worker antigo

O fonte original (`/root/disparo_worker.py`) só existe na VPS e não pôde ser lido daqui —
este reescrito foi reconstruído a partir do comportamento documentado + schema real
(migrations 069/077/079/080/081) + contrato da UI (`disparo_logs` com
`contact_phone/step_index/step_type/status/detail`). O smoke do cutover valida a paridade;
se o worker antigo tiver algum comportamento extra não documentado, anotar aqui antes de
apagá-lo.

## Bateria de testes E2E (`bateria_waha.py`)

Valida o pipeline de **ATENDIMENTO** (não o disparo): para cada caso (texto,
imagem, áudio ptt, vídeo, pdf, docx, xlsx, pptx, txt) envia pela API de produção
e espera o **eco `fromMe`** voltar pelo webhook, gravado no chat de destino
(`remetente=vendedor`, com `media_url`/`file_name` nas mídias). Exit 1 se algum
caso falhar.

**REGRA (26/09): envia APENAS para `6282735286` (`556282735286`)** — número
externo. Nunca trocar por números conectados: cria espelhamento (mensagem em 2
atendimentos) e polui a produção. O chat de destino é o atendimento real
"João Pedro" em `STK-1`.

```bash
cd /root/stk-crm && set -a && . /root/.stk-worker.env && set +a \
  && python3 worker/bateria_waha.py           # envia + asserções
python3 worker/bateria_waha.py --skip-send    # só re-asserção (sem mandar)
```

Env obrigatória: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (sem elas a
largada morre com `KeyError: 'SUPABASE_URL'`); opcional `BATERIA_URL`
(padrão: produção no Vercel).

Após rodar: apagar **só** as linhas com o marcador `bateria-<epoch>` do chat de
destino — nunca o atendimento (é conversa real).
