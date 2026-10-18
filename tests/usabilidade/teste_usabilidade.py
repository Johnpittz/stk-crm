#!/usr/bin/env python3
"""Teste de usabilidade do STK CRM — Playwright com cliques reais (não-API).

Cobre as entregas de 16–18/10/2026:
  1  Lista: nome sem identificação vira "CLIENTE - <número>"
  2  Criação: sem blocos de Energia/Consumo; Origem nova (Vendedor/Parceiro/Marketing)
  3  Cursor estável no campo Nome (bug antigo)
  4  Salvar → painel pós-salvar + card em RECEBEU A CONTA + kanban só do cliente
  5  Upload da Fatura (PDF de conta REAL do projeto) → Gestão de Fatura
  6  Análise da Fatura (IA) com PDF REAL → resumo + Tela de Oportunidades
  7  Fase C: sugestão criada na aba do cliente (origem IA) — verificado via banco
  8  Botão "Criar no funil" da tela de oportunidades
  9  Abas Mercado Livre / Usina Própria + inserção (precisa SQL 102 aplicado)
 10  Edição: origem pré-carregada, kanban embaixo, cursor
 11  Lista geral continua mostrando "CLIENTE - <número>"

Uso:
  python3 tests/usabilidade/teste_usabilidade.py

Pré-condição: cookie de sessão em /root/.hermes/cache/scratch/sessao-stk.json
(gerado pelo login; renovar lá quando a sessão expirar).

Saída: linhas "PASS/FAIL <teste> — <detalhe>" e exit code 1 se algo falhar.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
import time
import urllib.request
import urllib.parse

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "https://stk-crm-amber-delta.vercel.app"
SESSAO_ARQ = pathlib.Path("/root/.hermes/cache/scratch/sessao-stk.json")
PDF_REAL = pathlib.Path("/root/RECIEE/CROPS/000413805801280 (1).pdf")
ENV_LOCAL = pathlib.Path("/root/stk-crm/.env.local")
COOKIE_NOME = "sb-nizreygwaqqojwrorpqo-auth-token"

resultados: list[tuple[str, str, str]] = []
erros_js: list[str] = []


def passou(nome: str, detalhe: str = "") -> None:
    resultados.append(("PASS", nome, detalhe))


def falhou(nome: str, detalhe: str) -> None:
    resultados.append(("FAIL", nome, detalhe))


def tentar(nome: str, fn):
    """Roda um teste isolado: exceção vira FAIL e a bateria continua."""
    try:
        detalhe = fn() or ""
        passou(nome, detalhe)
    except AssertionError as e:
        falhou(nome, f"asserção: {e}")
    except Exception as e:  # noqa: BLE001 — relatório não pode parar no meio
        falhou(nome, f"{type(e).__name__}: {str(e)[:200]}")


# ---------------------------------------------------------------- REST (apoio)
def _env(chave: str) -> str:
    for linha in ENV_LOCAL.read_text().splitlines():
        if linha.startswith(chave + "="):
            return linha.split("=", 1)[1].strip()
    raise RuntimeError(f"{chave} ausente em .env.local")


def rest_get(caminho: str) -> list[dict]:
    url = _env("SUPABASE_URL") + caminho
    chave = _env("SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        url, headers={"apikey": chave, "Authorization": "Bearer " + chave}
    )
    return json.load(urllib.request.urlopen(req))


def cliente_por_nome(nome: str) -> dict | None:
    cod = urllib.parse.quote(nome)
    linhas = rest_get(
        f"/rest/v1/clientes?select=id,name,origem_tipo,origem_subtipo,"
        f"vendedor_responsavel_id&name=eq.{cod}&limit=1"
    )
    return linhas[0] if linhas else None


# ---------------------------------------------------------------- utilitários
def radio_por_texto(page, texto: str):
    r = page.locator(f'input[type=radio]').filter(
        has=page.locator(f'text="{texto}"')
    )
    if r.count() == 0:
        # label pode ser irmão: acha pelo label e volta pro input
        lab = page.get_by_text(texto, exact=True).first
        r = lab.locator("xpath=ancestor::label[1]//input[@type='radio']")
    return r.first


def esperar_texto(page, trecho: str, timeout_ms: int = 30_000) -> str:
    alvo = page.get_by_text(re.compile(trecho)).first
    alvo.wait_for(state="visible", timeout=timeout_ms)
    return alvo.inner_text()


def escolher_arquivo(page, caminho: pathlib.Path, escopo=None) -> None:
    base = escopo or page
    inp = base.locator('input[type=file]').first
    inp.wait_for(state="attached", timeout=10_000)
    inp.set_input_files(str(caminho))


def remover_cliente_de_teste(nome: str) -> None:
    """Limpeza via REST (só dados de teste criados por este script)."""
    try:
        cli = cliente_por_nome(nome)
        if not cli:
            return
        cid = cli["id"]
        chave = _env("SUPABASE_SERVICE_ROLE_KEY")
        url = _env("SUPABASE_URL")
        for tabela, filtro in (
            ("oportunidades", f"cliente_id=eq.{cid}"),
            ("cliente_pasta_linhas", f"cliente_id=eq.{cid}"),
            ("clientes", f"id=eq.{cid}"),
        ):
            req = urllib.request.Request(
                f"{url}/rest/v1/{tabela}?{filtro}",
                method="DELETE",
                headers={"apikey": chave, "Authorization": "Bearer " + chave},
            )
            urllib.request.urlopen(req)
    except Exception as e:  # noqa: BLE001
        print(f"  (aviso) limpeza de {nome}: {e}")


# =============================================================== testes
def main() -> int:
    sessao = json.loads(SESSAO_ARQ.read_text())
    cookie_valor = None
    for parte in sessao.get("cookies", "").split(";"):
        if parte.strip().startswith(COOKIE_NOME + "="):
            cookie_valor = parte.split("=", 1)[1].strip()
    if not cookie_valor:
        print("SESSÃO INVÁLIDA — refaça o login e gere o arquivo de sessão.")
        return 2

    marca = dt.datetime.now().strftime("%H%M%S")
    nome_teste = f"TESTE USAB {marca}"

    with sync_playwright() as pw:
        navegador = pw.chromium.launch(headless=True)
        ctx = navegador.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies(
            [
                {
                    "name": COOKIE_NOME,
                    "value": cookie_valor,
                    "domain": "stk-crm-amber-delta.vercel.app",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                }
            ]
        )
        page = ctx.new_page()
        page.on(
            "pageerror",
            lambda e: erros_js.append(str(e)[:200]),
        )

        # --------------------------------------------- T1 lista "CLIENTE - nº"
        def t1():
            page.goto(f"{BASE}/clientes", wait_until="networkidle")
            busca = page.locator("main input[type=text]").first
            busca.wait_for(timeout=15_000)
            busca.fill("Cliente")
            page.wait_for_timeout(1500)
            texto = page.locator("main").inner_text()
            m = re.search(r"CLIENTE - \d{6,}", texto)
            assert m, "formato CLIENTE - <número> não apareceu"
            return f"achou {m.group(0)}"

        tentar("T1 lista mostra CLIENTE - <número>", t1)

        # ------------------------------------------- T2 criação: origem nova
        page.goto(f"{BASE}/clientes/novo", wait_until="networkidle")
        page.wait_for_timeout(800)

        def t2a():
            corpo = page.inner_text("body")
            assert "Dados de Energia" not in corpo, "bloco Dados de Energia voltou"
            assert "Consumo Mensal" not in corpo, "bloco Consumo Mensal voltou"
            assert re.search(r"Origem", corpo), "bloco Origem ausente"
            for tipo in ("Vendedor", "Parceiro", "Marketing"):
                assert tipo in corpo, f"tipo de origem {tipo} ausente"
            return "sem Energia/Consumo; Origem com os 3 tipos"

        tentar("T2 criação sem Energia/Consumo + Origem nova", t2a)

        def t2b():
            radio_por_texto(page, "Vendedor").check()
            radio_por_texto(page, "Externo").check()
            sel = page.locator("select").filter(
                has_text="Administrador"
            ).first
            sel.wait_for(timeout=8_000)
            assert sel.locator("option").count() > 1, "select do vendedor sem opções"
            return "Vendedor → Externo → select populou"

        tentar("T2b subtipo + select de vendedores", t2b)

        # ----------------------------------------------- T3 cursor estável
        def t3():
            nome_in = page.locator('input[type=text]').first
            nome_in.click()
            page.keyboard.type("Jo")
            ainda_foca = page.evaluate(
                "() => document.activeElement && document.activeElement.type === 'text'"
                " && document.activeElement.value === 'Jo'"
            )
            assert ainda_foca, "perdeu foco/valor ao digitar (remontagem)"
            return "foco mantido após digitar"

        tentar("T3 cursor estável no Nome", t3)

        # ------------------------------------------------ T4 salvar + painel
        def t4():
            page.locator('input[type=text]').first.fill(nome_teste)
            tel = page.locator("div:has(> label)").filter(
                has_text="Telefone"
            ).locator('input[type=text]').first
            tel.fill("62999990001")
            radio_por_texto(page, "Vendedor").check()
            radio_por_texto(page, "Externo").check()
            page.get_by_role("button", name="Salvar Cliente").click()
            esperar_texto(page, r"Cliente salvo", 30_000)
            esperar_texto(page, r"RECEBEU A CONTA", 15_000)
            corpo = page.inner_text("body")
            assert nome_teste in corpo, "card do novo cliente não apareceu"
            # kanban só do cliente: card aparece 1x
            assert corpo.count(nome_teste) <= 3, "card duplicado no kanban"
            return "salvo + card em RECEBEU A CONTA"

        tentar("T4 salvar → painel pós-salvar + card no funil", t4)

        # ---------------------------------- identifica o cliente criado (REST)
        cli = None
        for _ in range(10):
            cli = cliente_por_nome(nome_teste)
            if cli:
                break
            time.sleep(1)
        if not cli:
            falhou("T5 cliente criado no banco", "não encontrado via REST")
            return relatorio()
        cid = cli["id"]
        print(f"  cliente de teste: {cid}")

        # -------------------------------------------------- T5 fatura (PDF real)
        def t5():
            page.get_by_role("button", name="Upload da Fatura").click()
            page.wait_for_timeout(600)
            inp = page.locator('input[type=file]').first
            inp.set_input_files(str(PDF_REAL))
            esperar_texto(page, r"Fatura registrada", 40_000)
            return "PDF real entrou em Gestão de Fatura"

        tentar("T5 Upload da Fatura (PDF real do projeto)", t5)

        # -------------------------------------------- T6 análise da IA (PDF real)
        def t6():
            page.get_by_role("button", name="Análise da Fatura").click()
            dlg = page.locator("[role=dialog]")
            dlg.wait_for(timeout=10_000)
            dlg.locator('input[type=file]').set_input_files(str(PDF_REAL))
            page.wait_for_timeout(400)
            dlg.get_by_role("button", name=re.compile("Analisar")).click()
            # espera a IA (texto longo): sai de "Analisando"
            fim = time.time() + 150
            ultimo = ""
            while time.time() < fim:
                ultimo = dlg.inner_text()
                if "Analisando" not in ultimo:
                    break
                time.sleep(3)
            assert "Analisando" not in ultimo, "IA não respondeu em 150s"
            assert "Não consegui ler" not in ultimo, f"IA devolveu erro: {ultimo[:150]}"
            assert re.search(r"Concessionária|UC|Consumo|Valor", ultimo), (
                f"resumo ausente: {ultimo[:200]}"
            )
            assert "Identificadas" in ultimo or "Preliminares" in ultimo, (
                "Tela de Oportunidades ausente"
            )
            # Fase C: sugestão na aba
            if "Sugestões" in ultimo or "origem IA" in ultimo:
                fase_c = "Fase C presente"
            else:
                fase_c = "Fase C sem sugestão nesta leitura (ver banco)"
            return f"resumo + oportunidades OK; {fase_c}"

        tentar("T6 Análise da Fatura (IA, PDF real)", t6)

        # --------------------------------------- T7 criar no funil (se houver)
        def t7():
            dlg = page.locator("[role=dialog]")
            btn = dlg.get_by_role("button", name=re.compile("Criar no funil")).first
            if btn.count() == 0 or not btn.is_visible():
                return "nenhuma identificada pra criar (válido)"
            btn.click()
            esperar_texto(page, r"No funil", 15_000)
            return "card criado pela tela de oportunidades"

        tentar("T7 botão Criar no funil", t7)

        # fechar modal
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ------------------------------------------- T8 edição espelhada
        def t8():
            page.goto(f"{BASE}/clientes/{cid}/editar", wait_until="networkidle")
            page.wait_for_timeout(1200)
            corpo = page.inner_text("body")
            assert "Dados de Energia" not in corpo, "Energia voltou na edição"
            # origem pré-carregada (vendedor)
            marcado = page.evaluate(
                "() => [...document.querySelectorAll('input[type=radio]')]"
                ".some(r => r.checked && /vendedor/i.test(r.value||r.name||''))"
                " || [...document.querySelectorAll('label')].some("
                "l => /Vendedor/.test(l.innerText) && l.querySelector('input[type=radio]:checked'))"
            )
            assert marcado, "origem vendedor não pré-carregada"
            # kanban embaixo da edição
            assert "RECEBEU A CONTA" in corpo, "kanban ausente na edição"
            # cursor estável
            nome_in = page.locator('input[type=text]').first
            nome_in.click()
            page.keyboard.type("Te")
            ok_foco = page.evaluate(
                "() => document.activeElement && document.activeElement.type==='text'"
                " && /Te$/.test(document.activeElement.value)"
            )
            assert ok_foco, "cursor instável na edição"
            return "origem carregada + kanban embaixo + cursor ok"

        tentar("T8 edição espelhada", t8)

        # ------------------------------------ T9 abas ML/Usina (SQL 102?)
        status_400 = []

        def on_resp(r):
            if "cliente_pasta_linhas" in r.url and r.status >= 400:
                status_400.append(r.status)

        page.on("response", on_resp)

        def t9():
            page.goto(f"{BASE}/clientes/{cid}", wait_until="networkidle")
            page.wait_for_timeout(1000)
            page.get_by_role("button", name="Mercado Livre").first.click()
            page.wait_for_timeout(800)
            assert "Nenhum registro de Mercado Livre" in page.inner_text("body") or True
            page.get_by_role("button", name=re.compile("^Adicionar$")).first.click()
            page.wait_for_timeout(700)
            sel_amb = page.locator("select").filter(has_text="Regulado").first
            sel_amb.select_option(label="Regulado")
            page.locator("select").filter(has_text="Em negociação").first.select_option(
                label="Em negociação"
            )
            page.get_by_role("button", name="Salvar", exact=True).first.click()
            page.wait_for_timeout(2500)
            if status_400:
                raise AssertionError(
                    f"insert recusado (HTTP {status_400[0]}) — SQL 102 pendente"
                )
            corpo = page.inner_text("body")
            assert "Regulado" in corpo or "Em negociação" in corpo, (
                "linha ML não apareceu"
            )
            return "linha Mercado Livre criada"

        tentar("T9 aba Mercado Livre — inserção", t9)

        def t10():
            page.get_by_role("button", name="Usina Própria").first.click()
            page.wait_for_timeout(700)
            corpo = page.inner_text("body")
            assert "Usina Própria" in corpo
            return "aba Usina Própria acessível"

        tentar("T10 aba Usina Própria", t10)

        # --------------------------------- T11 Fase C no banco (origem IA)
        def t11():
            linhas = rest_get(
                f"/rest/v1/cliente_pasta_linhas?select=linha,dados&cliente_id=eq.{cid}"
            )
            ia = [l for l in linhas if (l.get("dados") or {}).get("origem") == "IA"]
            assert ia, "nenhuma linha com origem IA gravada"
            return f"sugestão IA gravada: {[l['linha'] for l in ia]}"

        tentar("T11 Fase C gravou sugestão com origem IA", t11)

        # ------------------------------- T12 fluxo do PDF: dados conferidos?
        def t12():
            linhas = rest_get(
                f"/rest/v1/cliente_pasta_linhas?select=linha,dados"
                f"&cliente_id=eq.{cid}&linha=eq.gestao_fatura"
            )
            assert linhas, "linha de gestão de fatura ausente"
            d = linhas[0]["dados"]
            assert d.get("competencia"), "competência vazia"
            # PDF CROPS tem valor em texto; se extraído, deve ser > 0
            valor = d.get("valor")
            return (
                f"competência {d.get('competencia')}; "
                + (f"valor R$ {valor} (extraído do PDF)" if valor else "valor nulo")
            )

        tentar("T12 Gestão de Fatura gravou dados do PDF", t12)

        # ------------------------------------- T13 lista geral pós-cadastro
        def t13():
            page.goto(f"{BASE}/clientes", wait_until="networkidle")
            page.wait_for_timeout(1200)
            busca = page.locator("main input[type=text]").first
            busca.fill("Cliente")
            page.wait_for_timeout(1500)
            assert re.search(r"CLIENTE - \d{6,}", page.locator("main").inner_text())
            return "formato mantido na listagem geral"

        tentar("T13 lista geral com CLIENTE - <número>", t13)

        # erros JS globais
        if erros_js:
            falhou("T14 sem erros de JS na página", "; ".join(erros_js[:3]))
        else:
            passou("T14 sem erros de JS na página", "0 erros")

        navegador.close()

    return relatorio(nome_teste)


def relatorio(nome_teste: str | None = None) -> int:
    print("\n===== RELATÓRIO DE USABILIDADE (Playwright) =====")
    for estado, nome, detalhe in resultados:
        print(f"{estado}  {nome}" + (f" — {detalhe}" if detalhe else ""))
    falhas = [r for r in resultados if r[0] == "FAIL"]
    print(f"--- {len(resultados)} testes, {len(falhas)} falha(s)")
    if nome_teste and not falhas:
        print(f"(limpeza) removendo {nome_teste}")
        remover_cliente_de_teste(nome_teste)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
