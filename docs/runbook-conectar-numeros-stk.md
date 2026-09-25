# Runbook — Conectar os números WhatsApp do STK-CRM (WAHA)

> **Para humanos e IAs:** este documento descreve como conectar os números do STK-CRM ao WAHA.
> Cada número = uma **sessão** WAHA. Status do plano: `docs/plano-migracao-waha.md`.

## 0. ATENÇÃO ANTES DE QUALQUER COISA

- As 3 sessões **já foram criadas** (`STK-1`, `STK-2`, `STK-3`) e estão `STOPPED` — **não precisa criar**.
- **NÃO escaneie os QR antes de ser autorizado.** A Evolution API ainda está no ar com esses
  números; a troca de canal é um evento único, orquestrado no cutover (Fase 8 do plano).
  Escanear cedo = número conectado nos dois canais ao mesmo tempo = conflito.
- Ordem correta do cutover: **1)** deploy do código novo no Vercel → **2)** desligar as
  instâncias Evolution → **3)** iniciar as sessões WAHA e escanear (aqui) → **4)** backfill e smoke.

## 1. Onde o WAHA está

| Item | Valor |
|---|---|
| Servidor | VPS Hostinger `srv1745477.hstgr.cloud` (2.25.192.248) |
| Container | `waha` (Docker do host — NÃO é o container `john_hermes`) |
| Engine | `GOWS` (WebSocket Go, sem navegador) |
| API pública | `http://srv1745477.hstgr.cloud:3000` (usada pelo Vercel e pelo dashboard) |
| API interna | `http://172.16.1.1:3000` (**usar esta de dentro do container do code-server**) |
| Dashboard | `http://srv1745477.hstgr.cloud:3000/dashboard` (user `admin`) |
| Credenciais | `WAHA_API_KEY` em `/root/crm-roma/.env.local` — **nunca imprimir em logs/chat** |
| Sessões STK | `STK-1`, `STK-2`, `STK-3` (criadas em 24/09/2026, status `STOPPED`) |
| Webhook previsto | `https://stk-crm-amber-delta.vercel.app/api/webhooks/waha` |
| Eventos | `message.any`, `message.ack`, `session.status` |

⚠️ **Hairpin NAT:** de dentro do container do code-server, a URL pública:3000 **não conecta** —
use sempre `http://172.16.1.1:3000`. De fora (navegador/Vercel) a pública funciona.

## 2. Passo a passo para conectar um número (cutover)

Substitua `STK-N` por `STK-1`, `STK-2` ou `STK-3`.

```bash
# 0) helpers
GW=http://172.16.1.1:3000                       # de dentro do container do code-server
# GW=http://srv1745477.hstgr.cloud:3000         # de fora (VPS host, outro servidor)
K=$(grep '^WAHA_API_KEY=' /root/crm-roma/.env.local | cut -d= -f2)

# 1) Iniciar a sessão (STOPPED -> STARTING -> SCAN_QR_CODE)
curl -s -X POST $GW/api/sessions/STK-N/start -H "X-Api-Key: ***"
sleep 5

# 2) Conferir status (esperado: SCAN_QR_CODE)
curl -s -H "X-Api-Key: *** $GW/api/sessions/STK-N

# 3) Puxar o QR — ATENÇÃO: retorna um PNG cru (não JSON!)
curl -s -H "X-Api-Key: *** $GW/api/STK-N/auth/qr -o qr-stk-n.png
# -> enviar a imagem para quem vai escanear; QR vale ~20 segundos (repetir se vencer)

# 4) Depois do scan, confirmar:
curl -s -H "X-Api-Key: *** $GW/api/sessions/STK-N   # esperado: "status":"WORKING"
```

**Como escaneia:** WhatsApp do celular → ⋮ → **Aparelhos conectados** → **Conectar aparelho** → escanear.

## 3. Armadilhas (mesmas descobertas no CRM-ROMA)

| Situação | O que fazer |
|---|---|
| QR vence antes do scan → sessão `FAILED` | `POST /api/sessions/STK-N/stop`, sleep 3, `POST .../start`, sleep 6, puxar QR de novo. |
| `auth/qr` devolve JSON de erro | É sessão caída — reiniciar como acima. **PNG válido começa com `89 50 4e 47`**. |
| "Click to reload QR" no dashboard | Stop + Start na sessão. |
| Sessão `WORKING` depois do scan | Não mexer mais — se mantém sozinha; `session.status` reporta desconexões. |
| Webhook só no fim | Depois do scan, registrar o webhook: `PUT /api/sessions/STK-N` com `config.webhooks`
`[{"url":"https://stk-crm-amber-delta.vercel.app/api/webhooks/waha","events":["message.any","message.ack","session.status"]}]`
(vai `STARTING`→`WORKING` **sem novo QR**, login preservado — padrão já usado pela `ROMA_1`). |
| Webhook para URL interna (`172.16.1.x`) | **Não recebe** — só URL pública (Vercel). |
| Logs do container | `docker logs --tail 100 waha` só no **host** (hPanel → Web console). |

## 4. Teste de envio manual (após WORKING)

```bash
curl -s -X POST $GW/api/sendText -H "X-Api-Key: ***" -H "Content-Type: application/json" \
  -d '{"session":"STK-N","chatId":"55DDNUMERO@c.us","text":"Teste STK-CRM"}'
```

## 5. Manutenção

```bash
docker ps --filter name=waha       # no host: container rodando?
docker logs --tail 50 waha         # logs
docker restart waha                # reiniciar (sessões persistem no volume ~/waha/sessions)
curl -s -H "X-Api-Key: *** $GW/api/sessions   # status de todas
```
