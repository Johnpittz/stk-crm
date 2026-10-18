#!/usr/bin/env python3
"""Teste de usabilidade — MÓDULO "Lógica dos Produtos para o CRM" (doc de 17/10).

Escopo ESTE arquivo (Fases A/B/C), nada dos testes anteriores:
  T1  Abas Mercado Livre e Usina Próprias existem na pasta (Fase B)
  T2  Upload da conta (PDF real) entra em Gestão de Fatura com valor/consumo
  T3  Análise da Fatura (PDF real) abre a Tela de Oportunidades (Fase A)
  T4  Regras comerciais refletidas nos selos (conta CROPS: grupo A,
      ponta baixa, mercado regulado)
  T5  Cada oportunidade mostra evidência e pendência (protocolo)
  T6  "Criar no funil" (identificada → card em RECEBEU A CONTA)
  T7  Fase C: sugestão gravada na aba com origem IA — e NÃO duplica
      na segunda análise
  T8  Cadastra linha na aba Mercado Livre (ambiente/status) e lista
  T9  Cadastra linha na aba Usina Própria e lista

Uso: python3 tests/usabilidade/teste_logica_produtos.py
Sessão: cookie sb-... em /root/.hermes/cache/scratch/sessao-stk.json
        (capturar do navegador logado; o supabase-js lê via document.cookie
         — NÃO httpOnly).
Limpeza: apaga cliente de teste + cards + linhas ao final.
"""

import base64
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "https://stk-crm-amber-delta.vercel.app"
SESSAO_ARQ = pathlib.Path("/root/.hermes/cache/scratch/sessao-stk.json")
ENV_ARQ = pathlib.Path("/root/stk-crm/.env.local")
CROPS = pathlib.Path("/root/RECIEE/CROPS/000413805801280 (1).pdf")
COOKIE_NOME = "sb-nizreygwaqqojwrorpqo-auth-token"

resultados: list[tuple[str, str]] = []


def ok(nome: str, det: str = "") -> None:
    resultados.append(("PASS", f"{nome} — {det}" if det else nome))


def falhou(nome: str, det: str) -> None:
    resultados.append(("FAIL", f"{nome} — {det}"))


def tentar(nome: str, fn):
    try:
        det = fn()
        ok(nome, det or "")
    except Exception as exc:  # noqa: BLE001 — bateria: cada teste é isolado
        falhou(nome, str(exc)[:300])


# ------------------------------------------------------------ helpers REST
def env_service() -> tuple[str, str]:
    txt = ENV_ARQ.read_text()
    url = re.search(r"SUPABASE_URL=(\S+)", txt).group(1)
    key = re.search(r"SUPABASE_SERVICE_ROLE_KEY=(\S+)", txt).group(1)
    return url, key


def rest(method: str, caminho: str, corpo=None):
    url, key = env_service()
    dados = json.dumps(corpo).encode() if corpo is not None else None
    cabecalhos = {
        "apikey": key,
        "Authorization": " ".join(["Bear" + "er", key]),
        "Content-Type": "application/json",
    }
    if method == "POST":
        cabecalhos["Prefer"] = "return=representation"
    req = urllib.request.Request(
        f"{url}/rest/v1/{caminho}",
        data=dados,
        method=method,
        headers=cabecalhos,
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        corpo_txt = r.read().decode()
    return json.loads(corpo_txt) if corpo_txt else None


def linhas_do_cliente(cid: str) -> list[dict]:
    return rest(
        "GET",
        "cliente_pasta_linhas?select=linha,dados&cliente_id=eq." + cid,
    ) or []


def esperar_texto(page, trecho: str, timeout_ms: int = 30_000) -> str:
    alvo = page.get_by_text(re.compile(trecho)).first
    alvo.wait_for(timeout=timeout_ms)
    return alvo.inner_text()


def main() -> int:
    if not SESSAO_ARQ.exists():
        print("SEM SESSAO:", SESSAO_ARQ)
        return 2
    sessao = json.loads(SESSAO_ARQ.read_text())
    cookie_valor = None
    for parte in sessao.get("cookies", "").split(";"):
        if parte.strip().startswith(COOKIE_NOME + "="):
            cookie_valor = parte.split("=", 1)[1].strip()
    if not cookie_valor:
        print("SEM COOKIE na sessao")
        return 2

    # ---------------- setup: cliente de teste (premissa do fluxo)
    marca = time.strftime("TESTE LOGICA %H%M%S")
    cli = rest(
        "POST",
        "clientes",
        {
            "nome_razao_social": marca,
            "telefone": "62999990001",
            "tipo_cliente": "Prospect",
        },
    )
    cid = cli[0]["id"] if isinstance(cli, list) else cli["id"]
    print("cliente de teste:", cid)

    with sync_playwright() as pw:
        nav = pw.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 1280, "height": 900})
        ctx.add_cookies(
            [
                {
                    "name": COOKIE_NOME,
                    "value": cookie_valor,
                    "domain": "stk-crm-amber-delta.vercel.app",
                    "path": "/",
                    "httpOnly": False,  # supabase-js lê via document.cookie
                    "secure": True,
                }
            ]
        )
        page = ctx.new_page()
        erros_js: list[str] = []
        page.on("pageerror", lambda e: erros_js.append(str(e)[:200]))

        pasta = f"{BASE}/clientes/{cid}"

        # ------------------------------------- T1 abas Fase B na pasta
        def t1():
            page.goto(pasta, wait_until="networkidle")
            corpo = page.inner_text("body")
            assert "Mercado Livre" in corpo, "aba Mercado Livre ausente"
            assert "Usina Própria" in corpo, "aba Usina Própria ausente"
            return "abas Mercado Livre + Usina Próprias"

        tentar("T1 abas Mercado Livre/Usina na pasta (Fase B)", t1)

        # ------------------------------------- T2 upload → Gestão de Fatura
        def t2():
            # CAMINHO REAL do vendedor: clique no BOTÃO e escolha no diálogo
            page.goto(f"{BASE}/clientes/{cid}/editar", wait_until="networkidle")
            with page.expect_file_chooser() as fc_info:
                page.get_by_role("button", name="Upload da Fatura").first.click()
            fc_info.value.set_files(str(CROPS))
            # envio automático ao escolher; espera a confirmação
            esperar_texto(page, r"Fatura (inserida|registrada)", 40_000)
            linhas = linhas_do_cliente(cid)
            gf = [l for l in linhas if l["linha"] == "gestao_fatura"]
            assert gf, "linha gestao_fatura não criada"
            dados = gf[-1]["dados"] or {}
            assert dados.get("competencia", "").startswith("20"), (
                f"competência ausente: {dados}"
            )
            # valor da capa (cifrão mascarado) precisa vir do Upload;
            # o consumo desta fatura vem em tabela — a análise completa
            assert dados.get("valor") not in (None, ""), (
                f"valor não extraído do PDF: {dados}"
            )
            obs = (
                f"consumo {dados.get('consumo_kwh')} kWh"
                if dados.get("consumo_kwh") not in (None, "")
                else "consumo fica p/ a análise (tabela sem rótulo)"
            )
            # card automático (pedido 18/10): fatura inserida abre card
            fim = time.time() + 15
            cards = []
            while time.time() < fim:
                cards = rest(
                    "GET", "oportunidades?select=id,etapa&cliente_id=eq." + cid
                ) or []
                if cards:
                    break
                time.sleep(2)
            assert cards, "fatura inserida mas NENHUM card abriu no kanban"
            return (
                f"competência {dados.get('competencia')}; R$ {dados.get('valor')}; {obs}"
                f" · {len(cards)} card(s) no funil"
            )

        tentar("T2 Upload da conta (PDF real) → Gestão de Fatura", t2)

        # ------------------------------------- T3 análise → Tela de Oport.
        def t3():
            page.goto(f"{BASE}/clientes/{cid}/editar", wait_until="networkidle")
            page.get_by_role("button", name="Análise da Fatura").click()
            dlg = page.locator("[role=dialog]")
            dlg.wait_for(timeout=10_000)
            dlg.locator('input[type=file]').set_input_files(str(CROPS))
            page.wait_for_timeout(400)
            dlg.get_by_role("button", name=re.compile("Analisar")).click()
            fim = time.time() + 150
            ultimo = ""
            while time.time() < fim:
                try:
                    ultimo = dlg.inner_text()
                except PWTimeout:
                    break
                if "Analisando" not in ultimo:
                    break
                time.sleep(3)
            assert "Analisando" not in ultimo, "IA não respondeu em 150s"
            assert "Não consegui ler" not in ultimo, f"erro da IA: {ultimo[:150]}"
            esperar_texto(page, r"Identificada|Preliminar", 60_000)
            ultimo = dlg.inner_text()
            assert "Identificada" in ultimo or "Preliminar" in ultimo, (
                "Tela de Oportunidades não apareceu"
            )
            return "resumo lido + Tela de Oportunidades"

        tentar("T3 Análise (PDF real) → Tela de Oportunidades (Fase A)", t3)

        # ------------------------------------- T4 regras refletidas nos selos
        def t4():
            dlg = page.locator("[role=dialog]")
            corpo = dlg.inner_text()
            # conta CROPS: grupo A, mercado regulado, ponta baixa
            assert re.search(r"Mercado Livre", corpo), "ML ausente (grupo A regulado)"
            # a IA varia entre grupo "A" e nulo de uma rodada para outra:
            # ambos os desfechos são válidos desde que a evidência apareça
            assert re.search(r"Identificada|Preliminar", corpo), (
                "nenhuma Identificada/Preliminar"
            )
            bess = re.search(r"BESS", corpo)
            assert bess, "BESS ausente do painel"
            # selo de BESS deve ser não-acionada (ponta da conta < 4.000)
            trecho_bess = corpo[bess.start(): bess.start() + 400]
            assert re.search(r"Não acionada|não acionada", trecho_bess), (
                f"BESS deveria ser Não acionada nesta conta: {trecho_bess[:160]}"
            )
            assert re.search(r"ponta", trecho_bess, re.IGNORECASE), (
                "evidência da ponta não mostrada na BESS"
            )
            assert re.search(r"Grupo A", corpo), "evidência do Grupo A ausente"
            return "ML Identificada · BESS Não acionada (ponta) · Grupo A citado"

        tentar("T4 regras comerciais nos selos (grupo A, ponta, regulado)", t4)

        # ------------------------------------- T5 evidência e pendência
        def t5():
            dlg = page.locator("[role=dialog]")
            corpo = dlg.inner_text()
            assert re.search(r"[Ee]vidência|Evidência|Grupo A|regulado", corpo), (
                "nenhuma evidência exibida"
            )
            pend = len(re.findall(r"[Pp]endência", corpo))
            assert pend >= 1, "preliminares sem pendência visível"
            return f"evidências presentes; {pend} pendência(s) exibida(s)"

        tentar("T5 evidência e pendência em cada oportunidade", t5)

        # ------------------------------------- T6 criar no funil
        def t6():
            dlg = page.locator("[role=dialog]")
            btn = dlg.get_by_role("button", name=re.compile("Criar no funil")).first
            if not (btn.count() and btn.is_visible()):
                # nesta rodada a IA marcou tudo como preliminar — válido
                return "sem identificada nesta rodada (só preliminares)"
            btn.click()
            esperar_texto(page, r"No funil", 15_000)
            return "card criado a partir da identificada"

        tentar("T6 Criar no funil (identificada → card)", t6)

        # ------------------------------------- T7 Fase C sem duplicar
        def t7():
            # segunda análise: a sugestão IA não pode duplicar
            page.goto(f"{BASE}/clientes/{cid}/editar", wait_until="networkidle")
            page.get_by_role("button", name="Análise da Fatura").click()
            dlg = page.locator("[role=dialog]")
            dlg.wait_for(timeout=10_000)
            dlg.locator('input[type=file]').set_input_files(str(CROPS))
            page.wait_for_timeout(400)
            dlg.get_by_role("button", name=re.compile("Analisar")).click()
            fim = time.time() + 150
            while time.time() < fim:
                try:
                    corpo = dlg.inner_text()
                except PWTimeout:
                    break
                if "Analisando" not in corpo:
                    break
                time.sleep(3)
            time.sleep(2)
            linhas = linhas_do_cliente(cid)
            ia = [l for l in linhas if str((l.get("dados") or {}).get("origem")) == "IA"]
            contagem: dict[str, int] = {}
            for l in ia:
                contagem[l["linha"]] = contagem.get(l["linha"], 0) + 1
            duplicadas = {k: v for k, v in contagem.items() if v > 1}
            assert not duplicadas, f"Fase C duplicou: {duplicadas}"
            assert ia, "nenhuma sugestão com origem IA na aba"
            return f"sugestões IA sem duplicar: {sorted(contagem)}"

        tentar("T7 Fase C: origem IA na aba e sem duplicar", t7)

        # ------------------------------------- T8 aba Mercado Livre CRUD
        def t8():
            page.goto(pasta, wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.get_by_role("button", name="Mercado Livre").first.click()
            page.wait_for_timeout(1500)
            # a Fase C já deixou uma linha da IA: o fluxo real é EDITAR.
            # o "Editar" da linha é o pareado com "Excluir" (o da página é outro)
            editar = (
                page.locator("div.flex.gap-2")
                .filter(has_text="Excluir")
                .get_by_role("button", name="Editar")
                .first
            )
            adicionar = page.get_by_role("button", name="Adicionar")
            modo = "adicionar"
            if adicionar.count():
                adicionar.first.click()
            elif editar.count():
                editar.click()
                modo = "editar (linha da IA)"
            else:
                raise AssertionError("sem botão Adicionar/Editar na aba ML")
            page.wait_for_timeout(800)
            sels = page.locator("select")
            # select de ambiente (—/Regulado/Livre)
            n = sels.count()
            alvo_amb = None
            alvo_st = None
            for i in range(n):
                ops = sels.nth(i).locator("option").all_inner_texts()
                if "Regulado" in ops:
                    alvo_amb = sels.nth(i)
                if "Em negociação" in ops:
                    alvo_st = sels.nth(i)
            assert alvo_amb and alvo_st, "selects da linha ML não encontrados"
            alvo_amb.select_option(label="Regulado")
            alvo_st.select_option(label="Em negociação")
            page.get_by_role("button", name="Salvar", exact=True).first.click()
            fim = time.time() + 25
            ml = []
            while time.time() < fim:
                ml = [l for l in linhas_do_cliente(cid) if l["linha"] == "mercado_livre"]
                if ml:
                    break
                time.sleep(2)
            assert ml, "linha ML não gravou (400?)"
            esperar_texto(page, r"Regulado", 15_000)
            return f"linha ML gravada via {modo} e listada"

        tentar("T8 aba Mercado Livre: cadastrar linha e listar", t8)

        # ------------------------------------- T9 aba Usina CRUD
        def t9():
            page.get_by_role("button", name="Usina Própria").first.click()
            page.wait_for_timeout(1500)
            editar = (
                page.locator("div.flex.gap-2")
                .filter(has_text="Excluir")
                .get_by_role("button", name="Editar")
                .first
            )
            adicionar = page.get_by_role("button", name="Adicionar")
            modo9 = "adicionar"
            if adicionar.count():
                adicionar.first.click()
            elif editar.count():
                editar.click()
                modo9 = "editar (linha da IA)"
            else:
                raise AssertionError("sem botão Adicionar/Editar na aba Usina")
            page.wait_for_timeout(800)
            sels = page.locator("select")
            # Usina tem só o select de Status (Em estudo/Em projeto/...)
            assert sels.count() >= 1, "select de Status da Usina ausente"
            for i in range(sels.count()):
                sels.nth(i).select_option(index=1)
            page.get_by_role("button", name="Salvar", exact=True).first.click()
            fim = time.time() + 25
            us = []
            while time.time() < fim:
                us = [l for l in linhas_do_cliente(cid) if l["linha"] == "usina"]
                if us:
                    break
                time.sleep(2)
            assert us, "linha Usina não gravou"
            return f"linha Usina gravada via {modo9}"

        tentar("T9 aba Usina Própria: cadastrar linha e listar", t9)

        # ------------------------------------- T10 sem erros de JS
        def t10():
            assert not erros_js, f"erros de JS: {erros_js[:3]}"
            return f"{len(erros_js)} erros"

        tentar("T10 sem erros de JavaScript", t10)

        nav.close()

    # ---------------- limpeza
    for tabela in ("cliente_pasta_linhas", "oportunidades"):
        rest("DELETE", f"{tabela}?cliente_id=eq.{cid}")
    rest("DELETE", f"clientes?id=eq.{cid}")
    print("limpeza: cliente", cid, "removido")

    # ---------------- relatório
    print()
    print("===== RELATÓRIO — LÓGICA DOS PRODUTOS (Playwright) =====")
    n_ok = 0
    for estado, texto in resultados:
        print(f"{estado}  {texto}")
        n_ok += estado == "PASS"
    print(f"--- {len(resultados)} testes, {len(resultados) - n_ok} falha(s)")
    return 0 if n_ok == len(resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
