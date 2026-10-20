#!/usr/bin/env python3
"""Sonda WAHA: quem é cada sessão + últimas mensagens dos chats relevantes."""
import json
import urllib.request

alvo = "WAHA" + "_API" + "_KEY="
key = None
for line in open("/root/crm-roma/.env.local"):
    if line.startswith(alvo):
        key = line.strip().split("=", 1)[1]
        break
if not key:
    raise SystemExit("chave da API do WAHA não achada")

BASE = "http://172.16.1.1:3000"


def get(caminho):
    req = urllib.request.Request(BASE + caminho, headers={"X-Api-Key": key})
    return json.load(urllib.request.urlopen(req, timeout=15))


# 1) quem é cada sessão
sessoes = get("/api/sessions")
itens = sessoes if isinstance(sessoes, list) else sessoes.get("sessions", [])
print("=== sessões:")
for s in itens:
    print("  ", s.get("name"), "-> me:", s.get("me"), "| status:", s.get("status"))

# 2) chats recentes de STK-1 e STK-3 (com quem cada conta fala)
for sessao in ("STK-1", "STK-3"):
    try:
        chats = get(f"/api/{sessao}/chats?limit=10")
    except Exception as exc:
        print(f"=== {sessao} chats: ERRO {exc}")
        continue
    lista = chats if isinstance(chats, list) else chats.get("chats", chats.get("data", []))
    print(f"=== {sessao} chats:")
    for c in lista:
        idc = c.get("id") or c.get("jid") or ""
        if "556295094949" in str(idc) or "556299190117" in str(idc) or "lid" in str(idc):
            print("   ", idc, "| name:", c.get("name") or c.get("pushName"), "| unread:", c.get("unreadCount"))

# 3) mensagens do chat cruzado: STK-1 x 1117 e STK-3 x 4949
alvos = (("STK-1", "556299190117@c.us"), ("STK-3", "556295094949@c.us"))
for sessao, chat in alvos:
    try:
        msgs = get(f"/api/{sessao}/chats/{chat}/messages?limit=6")
    except Exception as exc:
        print(f"=== {sessao} x {chat}: ERRO {exc}")
        continue
    lista = msgs if isinstance(msgs, list) else msgs.get("messages", msgs.get("data", []))
    print(f"=== {sessao} ←→ {chat} últimas {len(lista)}:")
    for m in lista:
        corpo = str(m.get("body") or m.get("caption") or "")[:30]
        print(
            f"   ts={m.get('timestamp')} fromMe={m.get('fromMe')} "
            f"from={m.get('from')} to={m.get('to')} "
            f"id={m.get('id')} body={corpo!r}"
        )
