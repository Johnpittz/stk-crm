#!/usr/bin/env python3
"""
disparo_worker_waha.py — Worker de disparo em massa do STK-CRM via WAHA.

Substitui /root/disparo_worker.py (Evolution API) — docs/plano-migracao-waha.md Fase 7.

Comportamento (espelha o worker original documentado em PROGRESSO.MD, Fase 12):
  - Poll a cada 5s no Supabase por bulk_campaigns com status='running'
  - Envia via WAHA (sendText/sendImage) usando a sessão da campanha (instancia)
  - Fluxo de mensagens (fluxo_mensagens: texto/imagem) com intervalo_passos entre passos
  - delay_inicial antes do primeiro contato; intervalo entre contatos
  - Substituição de {{nome}} (lookup em clientes.telefone) e {{telefone}}
  - Contadores sent/failed atualizados por contato; logs em disparo_logs
  - Retoma de onde parou (offset = sent + failed) se reiniciar no meio
  - Respeita status 'paused' (para e continua depois)

Uso:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_URL=... WAHA_API_KEY=... \
    python3 disparo_worker_waha.py

Somente stdlib (sem pip) — roda na VPS (supervisor) ou em qualquer container.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WAHA_URL = os.environ.get("WAHA_API_URL", "").rstrip("/")
WAHA_KEY = os.environ.get("WAHA_API_KEY", "")
POLL_SECONDS = float(os.environ.get("DISPARO_POLL_SECONDS", "5"))
REQUEST_TIMEOUT = float(os.environ.get("DISPARO_TIMEOUT", "30"))


# ─── HTTP helpers (stdlib) ────────────────────────────────────────────

def _http(method: str, url: str, payload=None, headers=None, timeout=REQUEST_TIMEOUT):
    """Retorna (status, body_json_ou_texto). Não lança em HTTPError."""
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw else raw
        except json.JSONDecodeError:
            return e.code, raw
    except Exception as e:  # rede/timeout
        return 0, str(e)


def supabase_rest(method: str, table: str, query: str = "", payload=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    return _http(
        method,
        url,
        payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=representation",
        },
    )


def waha_send(endpoint: str, payload: dict):
    status, body = _http(
        "POST",
        f"{WAHA_URL}/api/{endpoint}",
        payload,
        headers={"X-Api-Key": WAHA_KEY},
    )
    return status, body


# ─── Regras de negócio (testáveis sem rede) ───────────────────────────

def normalizar_digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def formatar_chat_id(telefone: str) -> str:
    d = normalizar_digits(telefone)
    if d and not d.startswith("55") and len(d) <= 11:
        d = "55" + d
    return f"{d}@c.us"


def substituir_variaveis(texto: str, nome: str, telefone: str) -> str:
    """Substitui {{nome}} e {{telefone}} ({{promocao}} já vem resolvido do frontend)."""
    if not texto:
        return texto
    out = texto.replace("{{nome}}", nome or "").replace("{{telefone}}", telefone or "")
    return out


def offset_retomada(campaign: dict) -> int:
    """Contatos já processados = sent + failed (permite retomar após restart)."""
    return int(campaign.get("sent") or 0) + int(campaign.get("failed") or 0)


def montar_passos(campaign: dict) -> list:
    """
    Lista de passos a enviar por contato.
    - fluxo_mensagens presente: usa a sequência [{type, content|url, mimetype}]
    - legado: imagem_url primeiro (se houver) e depois a mensagem texto
    """
    fluxo = campaign.get("fluxo_mensagens")
    if isinstance(fluxo, list) and fluxo:
        passos = []
        for i, p in enumerate(fluxo):
            tipo = (p or {}).get("type")
            if tipo == "text" and p.get("content"):
                passos.append({"type": "text", "content": p["content"], "index": i})
            elif tipo == "image" and (p.get("url") or p.get("base64")):
                passos.append(
                    {
                        "type": "image",
                        "url": p.get("url"),
                        "base64": p.get("base64"),
                        "mimetype": p.get("mimetype") or "image/jpeg",
                        "filename": p.get("filename") or "imagem.jpg",
                        "index": i,
                    }
                )
        if passos:
            return passos

    passos = []
    if campaign.get("imagem_url"):
        passos.append(
            {
                "type": "image",
                "url": campaign["imagem_url"],
                "mimetype": campaign.get("imagem_mimetype") or "image/jpeg",
                "filename": "imagem.jpg",
                "index": 0,
            }
        )
    msg = campaign.get("message") or campaign.get("mensagem") or ""
    if msg:
        passos.append({"type": "text", "content": msg, "index": len(passos)})
    return passos


def passo_payload(passo: dict, chat_id: str, session: str, nome: str, telefone: str):
    """Retorna (endpoint, payload) do WAHA para o passo."""
    if passo["type"] == "text":
        return "sendText", {
            "session": session,
            "chatId": chat_id,
            "text": substituir_variaveis(passo["content"], nome, telefone),
        }
    # image
    if passo.get("url"):
        file = {"url": passo["url"], "mimetype": passo["mimetype"]}
    else:
        file = {"data": passo["base64"], "mimetype": passo["mimetype"]}
    file["filename"] = passo.get("filename") or "imagem.jpg"
    return "sendImage", {"session": session, "chatId": chat_id, "file": file}


# ─── Acesso a dados ───────────────────────────────────────────────────

def buscar_campanhas_running() -> list:
    status, data = supabase_rest(
        "GET", "bulk_campaigns", "?status=eq.running&select=*&order=created_at.asc"
    )
    if status != 200 or not isinstance(data, list):
        print(f"[Worker] Erro ao buscar campanhas: HTTP {status} {data}", file=sys.stderr)
        return []
    return data


def reclamar_campanha(campaign_id: str) -> bool:
    """Claim: só processa se ainda estiver 'running' (evita duplo worker)."""
    status, data = supabase_rest(
        "PATCH",
        "bulk_campaigns",
        f"?id=eq.{campaign_id}&status=eq.running&select=id",
        {"updated_at": datetime.now(timezone.utc).isoformat()},
    )
    return status == 200 and isinstance(data, list) and len(data) == 1


def atualizar_contadores(campaign_id: str, sent: int, failed: int, status=None, error_log=None):
    body = {"sent": sent, "failed": failed}
    if status:
        body["status"] = status
    if error_log is not None:
        body["error_log"] = error_log
    supabase_rest("PATCH", "bulk_campaigns", f"?id=eq.{campaign_id}", body)


def status_atual(campaign_id: str) -> str:
    status, data = supabase_rest("GET", "bulk_campaigns", f"?id=eq.{campaign_id}&select=status")
    if status == 200 and isinstance(data, list) and data:
        return data[0].get("status") or ""
    return ""


def registrar_log(campaign_id, phone, step_index, step_type, ok, detail=None):
    supabase_rest(
        "POST",
        "disparo_logs",
        "",
        {
            "campaign_id": campaign_id,
            "contact_phone": phone,
            "step_index": step_index,
            "step_type": step_type,
            "status": "ok" if ok else "err",
            "detail": detail,
        },
    )


_nome_cache: dict = {}


def resolver_nome(telefone: str) -> str:
    """{{nome}}: primeiro o cache, depois clientes.telefone (dígitos)."""
    d = normalizar_digits(telefone)
    if not d:
        return ""
    if d in _nome_cache:
        return _nome_cache[d]
    nome = ""
    try:
        # Tenta correspondência exata e depois 'contém' (telefone formatado)
        for q in (f"?telefone=eq.{urllib.parse.quote(telefone)}&select=nome_razao_social&limit=1",
                  f"?telefone=ilike.*{d[-8:]}*&select=nome_razao_social&limit=1"):
            status, data = supabase_rest("GET", "clientes", q)
            if status == 200 and isinstance(data, list) and data:
                nome = data[0].get("nome_razao_social") or data[0].get("nome") or ""
                if nome:
                    break
    except Exception:
        pass
    _nome_cache[d] = nome
    return nome


# ─── Processamento ────────────────────────────────────────────────────

def processar_campanha(campaign: dict) -> None:
    cid = campaign["id"]
    if not reclamar_campanha(cid):
        print(f"[Worker] Campanha {cid} não reclamada (outro worker?) — pulando")
        return

    numbers = campaign.get("numbers") or []
    session = campaign.get("instancia") or os.environ.get("WAHA_SESSION", "STK-1")
    intervalo = max(int(campaign.get("intervalo") or 5), 1)
    intervalo_passos = max(int(campaign.get("intervalo_passos") or 2), 1)
    delay_inicial = max(int(campaign.get("delay_inicial") or 0), 0)

    passos = montar_passos(campaign)
    if not passos:
        atualizar_contadores(cid, campaign.get("sent", 0), campaign.get("failed", 0),
                             status="failed", error_log="Campanha sem mensagem/imagem")
        return

    start = offset_retomada(campaign)
    sent = int(campaign.get("sent") or 0)
    failed = int(campaign.get("failed") or 0)

    print(f"[Worker] Campanha '{campaign.get('name')}' sessão={session} "
          f"contatos={len(numbers)} offset={start} passos={len(passos)}")

    if start == 0 and delay_inicial > 0:
        print(f"[Worker] delay_inicial: {delay_inicial}s")
        time.sleep(delay_inicial)

    for idx in range(start, len(numbers)):
        # Retomada/pausa: se a campanha saiu de 'running', para (UI pode retomar)
        st = status_atual(cid)
        if st != "running":
            print(f"[Worker] Campanha {cid} status='{st}' — parando")
            return

        contato = numbers[idx]
        if isinstance(contato, dict):
            telefone = contato.get("telefone") or contato.get("phone") or ""
            nome = contato.get("nome") or resolver_nome(telefone)
        else:
            telefone = str(contato)
            nome = resolver_nome(telefone)

        chat_id = formatar_chat_id(telefone)
        ok_all = True
        for passo in passos:
            endpoint, payload = passo_payload(passo, chat_id, session, nome, telefone)
            status, body = waha_send(endpoint, payload)
            ok = 200 <= status < 300
            detail = None
            if not ok:
                ok_all = False
                detail = str(body)[:500]
            registrar_log(cid, telefone, passo.get("index", 0), passo["type"], ok, detail)
            if not ok:
                print(f"[Worker] ERRO {endpoint} {chat_id}: {body}", file=sys.stderr)
                break
            if passo is not passos[-1]:
                time.sleep(intervalo_passos)

        if ok_all:
            sent += 1
        else:
            failed += 1
        atualizar_contadores(cid, sent, failed)
        print(f"[Worker] {idx + 1}/{len(numbers)} {telefone} -> {'ok' if ok_all else 'falhou'}")

        if idx < len(numbers) - 1:
            time.sleep(intervalo)

    final_status = "completed" if sent > 0 else "failed"
    atualizar_contadores(cid, sent, failed, status=final_status)
    print(f"[Worker] Campanha {cid} finalizada: {final_status} (sent={sent}, failed={failed})")


def main() -> None:
    faltando = [n for n, v in (("SUPABASE_URL", SUPABASE_URL),
                               ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
                               ("WAHA_API_URL", WAHA_URL),
                               ("WAHA_API_KEY", WAHA_KEY)) if not v]
    if faltando:
        print(f"[Worker] Env vars obrigatórias faltando: {', '.join(faltando)}", file=sys.stderr)
        sys.exit(2)

    print(f"[Worker] Iniciado. Supabase={SUPABASE_URL} WAHA={WAHA_URL} poll={POLL_SECONDS}s")
    while True:
        try:
            for campaign in buscar_campanhas_running():
                processar_campanha(campaign)
        except Exception as e:  # nunca morrer por 1 erro
            print(f"[Worker] Erro no loop: {e}", file=sys.stderr)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
