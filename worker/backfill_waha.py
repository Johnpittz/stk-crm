#!/usr/bin/env python3
"""
backfill_waha.py — Recupera mensagens perdidas na janela morta da migração WAHA
(docs/plano-migracao-waha.md Fase 8, passo 5).

A VPS antiga (Evolution) caiu em ~2026-09-21T12:51Z (última mensagem registrada).
Mensagens enviadas/recebidas nesse intervalo existem no WhatsApp (sessões WAHA
novas fazem history sync), mas não entraram no Supabase. Este script:

  1. Para cada atendimento aberto (por instancia/telefone), busca o histórico
     no WAHA desde a janela morta (GET /api/{sessao}/chats/{chat}/messages)
  2. Insere só o que não existe (dedup por whatsapp_message_id)
  3. Mídia: baixa (URL localhost → gateway + X-Api-Key) e regrava no
     Supabase Storage bucket "media" (mesmo comportamento do webhook)
  4. Recalcula ultima_mensagem/ultima_mensagem_data do atendimento

Idempotente: rodar de novo não duplica.

Uso:  . /app/stk-worker/env && python3 backfill_waha.py [--dry-run]
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

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WAHA_URL = os.environ.get("WAHA_API_URL", "http://172.16.1.1:3000").rstrip("/")
WAHA_KEY = os.environ["WAHA_API_KEY"]

# Última mensagem registrada antes da queda (PROGRESSO/log) — folga de 1h
JANELA_INICIO = "2026-09-21T11:00:00.000Z"
JANELA_EPOCH = 1789988400.0  # 2026-09-21T11:00:00Z em epoch segundos
DRY = "--dry-run" in sys.argv

MEDIA_TIPO = {
    "image": "image", "jpeg": "image", "png": "image", "webp": "image", "gif": "image",
    "audio": "audio", "opus": "audio", "ogg": "audio", "mp3": "audio",
    "video": "video", "mp4": "video",
    "pdf": "documento", "doc": "documento", "docx": "documento",
    "xls": "documento", "xlsx": "documento",
}


def _http(method, url, payload=None, headers=None, raw=False, timeout=60):
    hdrs = dict(headers or {})
    data = None
    if payload is not None:
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            if raw:
                return resp.status, body
            try:
                return resp.status, json.loads(body) if body else None
            except json.JSONDecodeError:
                return resp.status, body.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body) if body else body.decode("utf-8", "replace")
        except Exception:
            return e.code, body.decode("utf-8", "replace")


def sb(method, table, query="", payload=None):
    return _http(
        method, f"{SUPABASE_URL}/rest/v1/{table}{query}", payload,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Prefer": "return=representation"},
    )


def _id_final(wid: str) -> str:
    """Normaliza ids: GOWS devolve 'true_<chat>_<hash>', a Evolution só o hash."""
    return (wid or "").rsplit("_", 1)[-1].lower()


def normalizar_chat(telefone: str) -> str:
    d = re.sub(r"\D", "", telefone or "")
    if d and not d.startswith("55") and len(d) <= 11:
        d = "55" + d
    return f"{d}@c.us"


def ts_para_iso(ts) -> str:
    if ts is None:
        return datetime.now(timezone.utc).isoformat()
    t = float(ts)
    if t > 1e12:  # milissegundos
        t /= 1000.0
    return datetime.fromtimestamp(t, tz=timezone.utc).isoformat()


def tipo_midia_de(media: dict) -> str:
    mime = (media.get("mimetype") or "").lower()
    for frag, tipo in MEDIA_TIPO.items():
        if frag in mime:
            return tipo
    return "documento"


def url_midia(url: str) -> str:
    """URL localhost/privada do WAHA → URL pública alcançável (mesmo bug do webhook)."""
    if not url:
        return url
    return re.sub(r"^https?://(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.)[^/]*",
                  WAHA_URL, url)


def baixar_midia(url: str) -> bytes:
    status, body = _http("GET", url_midia(url), headers={"X-Api-Key": WAHA_KEY}, raw=True)
    if status != 200 or not isinstance(body, (bytes, bytearray)):
        raise RuntimeError(f"download mídia HTTP {status}")
    return bytes(body)


def subir_storage(data: bytes, mime: str, prefix: str) -> str | None:
    ext = (mime.split("/")[-1].split(";")[0] or "bin").replace("jpeg", "jpg")
    path = f"{prefix}/{int(time.time()*1000)}-{os.urandom(4).hex()}.{ext}"
    status, body = _http(
        "POST", f"{SUPABASE_URL}/storage/v1/object/media/{path}", data,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": mime, "x-upsert": "false"},
    )
    if status not in (200, 201):
        print(f"    ! storage upload HTTP {status}: {str(body)[:150]}")
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/media/{path}"


def main():
    print(f"[Backfill] janela desde {JANELA_INICIO} | dry_run={DRY}")

    # 1) atendimentos-alvo: abertos + fechados/atualizados desde a queda
    alvos = []
    for q in (
        "?status=eq.aberto&select=id,telefone_cliente,instancia",
        f"?status=neq.aberto&updated_at=gte.{JANELA_INICIO}&select=id,telefone_cliente,instancia",
    ):
        st, data = sb("GET", "atendimentos", q + "&limit=500")
        if st == 200 and isinstance(data, list):
            alvos.extend(data)
    vistos = set()
    alvos = [a for a in alvos if not (a["id"] in vistos or vistos.add(a["id"]))]
    print(f"[Backfill] {len(alvos)} atendimentos-alvo")

    total_ins = total_skip = total_erros = 0

    for at in alvos:
        chat = normalizar_chat(at["telefone_cliente"])
        sessao = at["instancia"] or "STK-1"

        # 2) ids já existentes (dedup)
        st, existentes = sb(
            "GET", "atendimento_mensagens",
            f"?atendimento_id=eq.{at['id']}&select=whatsapp_message_id&limit=5000",
        )
        if st != 200 or not isinstance(existentes, list):
            print(f"  {sessao} {chat}: ERRO ao ler existentes HTTP {st} — pulando")
            total_erros += 1
            continue
        # dedup com id normalizado: GOWS usa "true_<chat>_<hash>" e a Evolution
        # usava só o hash — compara o trecho final (minúsculo)
        ids = {_id_final(m["whatsapp_message_id"]) for m in existentes
               if m.get("whatsapp_message_id")}
        ids.update(_id_final(m["whatsapp_message_id"]) for m in existentes
                   if m.get("whatsapp_message_id"))

        # 3) histórico WAHA desde a janela
        url = (f"{WAHA_URL}/api/{urllib.parse.quote(sessao)}/chats/{urllib.parse.quote(chat)}"
               f"/messages?start_date={urllib.parse.quote(JANELA_INICIO)}&limit=1000")
        st, hist = _http("GET", url, headers={"X-Api-Key": WAHA_KEY})
        if st != 200 or not isinstance(hist, list):
            print(f"  {sessao} {chat}: histórico HTTP {st} — {str(hist)[:120]}")
            total_erros += 1
            continue

        novos = []
        for m in hist:
            p = m.get("payload", m)
            mid = p.get("id") or ""
            if not mid or _id_final(mid) in ids:
                total_skip += 1
                continue
            # WAHA ignora start_date e devolve o histórico inteiro — filtra a janela aqui
            if float(p.get("timestamp") or 0) < JANELA_EPOCH:
                total_skip += 1
                continue
            ids.add(_id_final(mid))
            if p.get("isEvent") or p.get("type") in ("gp2", "notification"):
                continue
            from_me = bool(p.get("fromMe"))
            body = p.get("body") or ""
            media = p.get("media") or None
            if media and not body:
                conteudo = f"[{tipo_midia_de(media)}]"
            elif media:
                conteudo = body  # legenda
            else:
                conteudo = body
            if not conteudo:
                total_skip += 1
                continue

            row = {
                "atendimento_id": at["id"],
                "remetente": "vendedor" if from_me else "cliente",
                "conteudo": conteudo,
                "whatsapp_message_id": mid,
                "created_at": ts_para_iso(p.get("timestamp")),
                # chaves uniformes em todo lote (exigência do PostgREST)
                "media_url": None,
                "media_type": None,
                "file_name": None,
            }
            if media and (media.get("url") or media.get("file")):
                try:
                    murl = media.get("url") or media.get("file")
                    data = baixar_midia(murl)
                    pub = subir_storage(data, media.get("mimetype") or "application/octet-stream",
                                        tipo_midia_de(media))
                    if pub:
                        row["media_url"] = pub
                        row["media_type"] = tipo_midia_de(media)
                        row["file_name"] = media.get("filename") or None
                except Exception as e:
                    print(f"    ! mídia {mid[:30]}: {e}")
            novos.append(row)

        novos.sort(key=lambda r: r["created_at"])
        if novos and not DRY:
            st, resp = sb("POST", "atendimento_mensagens", "", novos)
            if st in (200, 201):
                total_ins += len(novos)
                print(f"  {sessao} {chat}: +{len(novos)} mensagens")
                # 4) recalcula última mensagem do atendimento
                ultimo = novos[-1]
                sb("PATCH", "atendimentos", f"?id=eq.{at['id']}", {
                    "ultima_mensagem": ultimo["conteudo"],
                    "ultima_mensagem_data": ultimo["created_at"],
                    "ultima_mensagem_remetente": ultimo["remetente"],
                })
            else:
                total_erros += len(novos)
                print(f"  {sessao} {chat}: ERRO insert HTTP {st}: {str(resp)[:200]}")
        elif novos:
            total_ins += len(novos)
            print(f"  {sessao} {chat}: [dry] {len(novos)} mensagens entrariam")
        else:
            print(f"  {sessao} {chat}: nada novo ({len(hist)} do histórico)")

        time.sleep(0.4)

    print(f"[Backfill] fim. inseridas={total_ins} já_existiam={total_skip} erros={total_erros}")
    sys.exit(1 if total_erros else 0)


if __name__ == "__main__":
    main()
