import json, urllib.request

KEY = None
for line in open("/root/crm-roma/.env.local"):
    if line.startswith("WAHA_API_KEY="):
        KEY = line.strip().split("=", 1)[1]
        break

req = urllib.request.Request("http://172.16.1.1:3000/api/sessions", headers={"X-Api-Key": KEY})
sessoes = json.load(urllib.request.urlopen(req, timeout=20))
for s in sessoes:
    cfg = (s.get("config") or {}).get("webhooks") or []
    eventos = [(w.get("events"), w.get("url", "")[:60]) for w in cfg]
    print(f"{s['name']}: {s['status']} | webhooks: {eventos}")
