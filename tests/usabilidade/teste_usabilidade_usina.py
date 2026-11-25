"""Bateria de usabilidade — ABA "ESTUDO USINA" (Fase1 do estudo de usina,25/11/2026).

Alvo: produção (https://stk-crm-amber-delta.vercel.app) — a mudança está no ar e
o banco é o mesmo. Cria um cliente de teste via REST, exercita a aba com cliques
reais e limpa tudo ao final.

Rodar: cd /root/stk-crm && python3 tests/usabilidade/teste_usabilidade_usina.py
Sessão: cookie sb- em /root/.hermes/cache/scratch/stk_session.json (regenerar pelo
login no cofre se estiver expirado).
"""
import json, os, sys, urllib.request, traceback
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE = "https://stk-crm-amber-delta.vercel.app"
SESSAO = "/root/.hermes/cache/scratch/stk_session.json"
HOJE = datetime.now(timezone.utc).date().isoformat()

env = {}
for line in open("/root/stk-crm/.env.local"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v.strip().strip('"').strip("'")
SUPA, SVC = env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
AUT = " ".join(["Bear" + "er", SVC])

resultados = []


def ok(nome, detalhe=""):
    resultados.append(("PASS", nome, detalhe))
    print(f"PASS {nome} — {detalhe}", flush=True)


def falhou(nome, detalhe):
    resultados.append(("FAIL", nome, detalhe))
    print(f"FAIL {nome} — {detalhe}", flush=True)


def teste(nome):
    def dec(fn):
        def run(*a, **k):
            try:
                fn(*a, **k)
            except Exception as e:
                if isinstance(e, SystemExit):
                    raise
                falhou(nome, f"{type(e).__name__}: {str(e)[:300]}")
                traceback.print_exc(limit=2)
        return run
    return dec


def rest(method, path, payload=None):
    req = urllib.request.Request(
        SUPA + "/rest/v1" + path,
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"apikey": SVC, "Authorization": AUT, "Content-Type": "application/json",
                 "Prefer": "return=representation"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"[]")


# ─── setup: cliente de teste ───
sess = json.load(open(SESSAO))
cli = rest("POST", "/clientes", {
    "nome_razao_social": "USINA TESTE USABILIDADE",
    "consumo_jan": 900, "consumo_fev": 1100,
})[0]
CID = cli["id"]
print("cliente teste:", CID, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1400, "height": 900}, accept_downloads=True)
    ctx.add_cookies([{"name": sess["name"], "value": sess["value"],
                      "domain": sess["domain"], "path": "/", "httpOnly": False,
                      "secure": True, "sameSite": "Lax"}])
    page = ctx.new_page()
    erros_console = []
    page.on("console", lambda m: erros_console.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: erros_console.append(f"pageerror: {str(e)[:300]}"))

    def abrir_aba():
        """Caminho do usuário: pasta do cliente → clique na aba Estudo Usina."""
        page.goto(f"{BASE}/clientes/{CID}", wait_until="domcontentloaded")
        page.get_by_role("button", name="Estudo Usina").wait_for(timeout=20000)
        page.get_by_role("button", name="Estudo Usina").click()
        page.locator("#estudo-consumo").wait_for(timeout=15000)

    @teste("T1 — abre a pasta do cliente e clica na aba Estudo Usina")
    def t1():
        abrir_aba()
        assert page.get_by_role("heading", name="Estudo de usina solar").is_visible()
        ok("T1", "aba abre e mostra o título do estudo")

    @teste("T2 — consumo pré-preenchido com a média das faturas do cliente")
    def t2():
        abrir_aba()
        v = page.locator("#estudo-consumo").input_value()
        assert v == "1000", f"esperava1000, veio '{v}'"
        ok("T2", "consumo =1000 (média de900+1100)")

    @teste("T3 — sem tarifa: aviso visível e botão Salvar DESABILITADO")
    def t3():
        abrir_aba()
        assert page.get_by_text("Informe a tarifa em R$/kWh (maior que zero).").is_visible()
        assert page.get_by_role("button", name="Salvar estudo").is_disabled()
        ok("T3", "aviso claro + botão travado (sem falha silenciosa)")

    @teste("T4 — digitar tarifa calcula o dimensionamento na hora")
    def t4():
        abrir_aba()
        page.locator("#estudo-tarifa").fill("0,95")
        page.get_by_text("8,40 kWp").wait_for(timeout=10000)
        assert page.get_by_text("16", exact=True).is_visible(), "nº de painéis"
        assert page.get_by_text("105,0%", exact=True).is_visible(), "cobertura"
        ok("T4", "8,40 kWp ·16 painéis · cobre105,0% (módulo525 Wp padrão)")

    @teste("T5 — Salvar grava o estudo no cliente (prova no banco)")
    def t5():
        abrir_aba()
        page.locator("#estudo-tarifa").fill("0,95")
        page.get_by_text("8,40 kWp").wait_for(timeout=10000)
        page.get_by_role("button", name="Salvar estudo").click()
        page.get_by_text("Estudo salvo na pasta do cliente").wait_for(timeout=15000)
        linha = rest("GET", f"/clientes?id=eq.{CID}&select=usina")[0]
        estudo = json.loads(linha["usina"]).get("estudo")
        assert estudo, "chave estudo ausente no banco"
        assert estudo["consumoMensalKwh"] == 1000
        assert estudo["resultado"]["numPaineis"] == 16
        assert estudo["geradoEm"][:10] == HOJE, f"gravado em {estudo['geradoEm']}"
        ok("T5", f"banco confirma: {estudo['resultado']['numPaineis']} painéis, gravado hoje")

    @teste("T6 — recarregar a página restaura o estudo salvo")
    def t6():
        abrir_aba()
        assert page.locator("#estudo-consumo").input_value() == "1000"
        assert page.locator("#estudo-tarifa").input_value() == "0,95"
        assert page.get_by_text("8,40 kWp").is_visible(), "resultado recalculado após reload"
        ok("T6", "consumo/tarifa/resultado voltam do banco após reload")

    @teste("T7 — botão Baixar proposta PDF gera o arquivo")
    def t7():
        abrir_aba()
        page.locator("#estudo-tarifa").fill("0,95")
        page.get_by_text("8,40 kWp").wait_for(timeout=10000)
        with page.expect_download(timeout=20000) as dl:
            page.get_by_role("button", name="Baixar proposta PDF").click()
        d = dl.value
        destino = "/tmp/proposta-usina-teste.pdf"
        d.save_as(destino)
        tam = os.path.getsize(destino)
        assert tam > 2000, f"pdf pequeno demais: {tam} bytes"
        ok("T7", f"PDF baixado: {d.suggested_filename} ({tam} bytes)")

    @teste("T8 — Enviar para o funil cria a oportunidade (prova no banco)")
    def t8():
        abrir_aba()
        page.locator("#estudo-tarifa").fill("0,95")
        page.get_by_text("8,40 kWp").wait_for(timeout=10000)
        page.get_by_role("button", name="Enviar para o funil").click()
        page.get_by_text("Enviado ao funil").wait_for(timeout=15000)
        cards = rest("GET", f"/oportunidades?cliente_id=eq.{CID}&select=titulo,etapa,created_at")
        meu = [c for c in cards if str(c["titulo"]).startswith("Estudo de usina")]
        assert meu, f"oportunidade não achada no banco: {cards}"
        assert meu[0]["etapa"] == "recebeu_conta", meu[0]
        ok("T8", f"card '{meu[0]['titulo']}' em '{meu[0]['etapa']}'")

    @teste("T9 — caminho de erro: apagar o consumo bloqueia o cálculo")
    def t9():
        abrir_aba()
        page.locator("#estudo-tarifa").fill("0,95")
        page.get_by_text("8,40 kWp").wait_for(timeout=10000)
        page.locator("#estudo-consumo").fill("")
        page.get_by_text("Informe o consumo mensal em kWh (maior que zero).").wait_for(timeout=10000)
        assert page.get_by_role("button", name="Salvar estudo").is_disabled()
        ok("T9", "aviso de consumo vazio + salvar travado")

    for fn in (t1, t2, t3, t4, t5, t6, t7, t8, t9):
        fn()

    @teste("T10 — sem erro de console em nenhum passo")
    def t10():
        assert not erros_console, f"erros: {erros_console[:5]}"
        ok("T10", "console limpo")

    t10()
    ctx.close()
    b.close()

# ─── limpeza: oportunidade + cliente de teste ───
try:
    cards = rest("GET", f"/oportunidades?cliente_id=eq.{CID}&select=id")
    for c in cards:
        rest("DELETE", f"/oportunidades?id=eq.{c['id']}")
    rest("DELETE", f"/clientes?id=eq.{CID}")
    print("limpeza: cliente e oportunidades de teste apagados", flush=True)
except Exception as e:
    print("limpeza falhou:", e, flush=True)

npass = sum(1 for r in resultados if r[0] == "PASS")
nfail = sum(1 for r in resultados if r[0] == "FAIL")
print(f"\nTOTAL: {npass} PASS / {nfail} FAIL", flush=True)
sys.exit(1 if nfail else 0)
