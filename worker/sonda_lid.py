#!/usr/bin/env python3
"""Sonda WAHA: resolve o LID problemático, lista crua de mensagens e contato."""
import json
import urllib.request
import urllib.error

alvo = "WAHA" + "_API" + "_KEY="
key = None
for line in open("/root/crm-roma/.env.local"):
    if line.startswith(alvo):
        key = line.strip().split("=", 1)[1]
        break

BASE = "http://172.16.1.1:3000"
LID = "183095059849432@lid"


def get(caminho):
    req = urllib.request.Request(BASE + caminho, headers={"X-Api-Key": key})
    try:
        return json.load(urllib.request.urlopen(req, timeout=15)), None
    except urllib.error.HTTPError as exc:
        return None, f"HTTP {exc.code}: {exc.read()[:200]}"
    except Exception as exc:
        return None, str(exc)


# 1) resolvedor de LID do WAHA
for sessao in ("STK-3", "STK-1", "STK-2"):
    dados, erro = get(f"/api/{sessao}/lids/{LID}")
    print(f"lids/{LID} @{sessao} ->", erro or dados)

# 2) mensagens cruas do chat (procura campo com telefone: fromAlt/participantAlt/_data)
dados, erro = get(f"/api/STK-3/chats/{LID}/messages?limit=3")
if erro:
    print("mensagens:", erro)
else:
    itens = dados if isinstance(dados, list) else dados.get("messages", [])
    print("mensagens do chat:", len(itens))
    for m in itens:
        print("--- objeto completo:")
        print(json.dumps(m, ensure_ascii=False, indent=1)[:2500])

# 3) contato pelo wid (nome?)
for caminho in (
    f"/api/STK-3/contacts?wid={LID}",
    f"/api/STK-3/contacts/{LID}",
):
    dados, erro = get(caminho)
    print(caminho, "->", erro or json.dumps(dados, ensure_ascii=False)[:400])
