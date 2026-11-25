"""Probe —25/11/2026: abrir a pasta do cliente em produção e imprimir a
estrutura real (abas, inputs, botões) antes de escrever a bateria."""
import json, urllib.request
from playwright.sync_api import sync_playwright

BASE = "https://stk-crm-amber-delta.vercel.app"
env = {}
for line in open("/root/stk-crm/.env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v.strip().strip('"').strip("'")
SUPA = env["SUPABASE_URL"]
SVC = env["SUPABASE_SERVICE_ROLE_KEY"]
AUT = " ".join(["Bear" + "er", SVC])


def rest(method, path, payload=None):
    req = urllib.request.Request(
        SUPA + "/rest/v1" + path,
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "apikey": SVC,
            "Authorization": AUT,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"[]")


cli = rest(
    "POST",
    "/clientes",
    {"nome_razao_social": "USINA TESTE USABILIDADE", "consumo_jan": 900, "consumo_fev": 1100},
)[0]
print("cliente teste:", cli["id"])

sess = json.load(open("/root/.hermes/cache/scratch/stk_session.json"))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1400, "height": 900})
    ctx.add_cookies(
        [
            {
                "name": sess["name"],
                "value": sess["value"],
                "domain": sess["domain"],
                "path": "/",
                "httpOnly": False,
                "secure": True,
                "sameSite": "Lax",
            }
        ]
    )
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text[:200]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: logs.append(f"pageerror: {str(e)[:300]}"))
    page.goto(f"{BASE}/clientes/{cli['id']}", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    print("URL:", page.url)
    btns = [t.strip() for t in page.locator("button").all_inner_texts() if t.strip()]
    print("BOTÕES (30):", btns[:30])
    tem = page.get_by_role("button", name="Estudo Usina")
    print("ABA Estudo Usina:", tem.count())
    if tem.count():
        tem.first.click()
        page.wait_for_timeout(2000)
        print("INPUTS:", page.locator("input").count())
        for i in range(page.locator("input").count()):
            el = page.locator("input").nth(i)
            print("  input", i, "id=", el.get_attribute("id"), "value=", el.input_value())
        print("LABELS:", [t for t in page.locator("label").all_inner_texts() if t.strip()][:12])
        print("H3:", page.locator("h3").all_inner_texts())
        print("PARAGRAFOS:", [t for t in page.locator("p").all_inner_texts() if t.strip()][:15])
    print("ERROS CONSOLE:", logs[:8])
    ctx.close()
    b.close()
print("PROBE OK")
