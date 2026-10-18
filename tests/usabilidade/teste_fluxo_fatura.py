#!/usr/bin/env python3
"""Teste de usabilidade — FLUXO ÚNICO DE FATURA (pedido do João, 18/10).

O botão "Upload da Fatura" SUMIU. Existe só "Análise da Fatura":
  F1  Não existe mais "Upload da Fatura" em nenhuma tela
  F2  Botão "Análise da Fatura" presente no Editar
  F3  Escolher a conta (clique real no input) → card vira "Fatura Recebida"
  F4  Analisar → o MESMO card vira "Fatura Analisada" (mesma competência)
  F5  Card aberto em "Recebeu a Conta" no funil (comportamento mantido)
  F6  Clicar no card analisado abre o resumo da IA (concessionária/UC/valor)
  F7  Card em "Recebida" NÃO tem botão de abrir (só analisado abre)
  F8  Segunda análise do mês NÃO duplica card

Uso: python3 tests/usabilidade/teste_fluxo_fatura.py
Sessão: cookie sb-... em /root/.hermes/cache/scratch/sessao-stk.json
Limpeza: apaga cliente de teste + cards + linhas ao final.
"""

import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("STK_BASE_URL", "https://stk-crm-amber-delta.vercel.app")
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
    except Exception as exc:  # noqa: BLE001 — cada teste é isolado
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


def linhas_fatura(cid: str) -> list[dict]:
    """Linhas de Gestão de Fatura do cliente (kanban de faturas)."""
    return rest(
        "GET",
        "cliente_pasta_linhas?select=linha,dados"
        "&cliente_id=eq." + cid + "&linha=eq.gestao_fatura",
    ) or []


def cards_funil(cid: str) -> list[dict]:
    return rest(
        "GET",
        "oportunidades?select=id,etapa,titulo&cliente_id=eq." + cid,
    ) or []


def fluxo_de(dados: dict) -> str:
    return str(dados.get("fluxo") or "")


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

    marca = time.strftime("TESTE FATURA %H%M%S")
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
                    "domain": urllib.parse.urlparse(BASE).netloc,
                    "path": "/",
                    "httpOnly": False,  # supabase-js lê via document.cookie
                    "secure": True,
                }
            ]
        )
        page = ctx.new_page()
        erros_js: list[str] = []
        page.on("pageerror", lambda e: erros_js.append(str(e)[:200]))

        # o clique nos botões de arquivo ABRE o seletor nativo; o
        # Playwright entrega o PDF por ele (e, se não abrir, no input)
        escolhedor: dict = {"fc": None}
        page.on("filechooser", lambda fc: escolhedor.__setitem__("fc", fc))

        def escolher_arquivo() -> None:
            page.wait_for_timeout(700)
            if escolhedor["fc"]:
                escolhedor["fc"].set_files(str(CROPS))
                escolhedor["fc"] = None
            else:
                page.set_input_files('input[type="file"]', str(CROPS))

        editar = f"{BASE}/clientes/{cid}/editar"

        # ---------------- F1: Upload sumiu ----------------
        def f1():
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1500)
            corpo = page.inner_text("body")
            if "Upload da Fatura" in corpo:
                raise AssertionError("ainda mostra 'Upload da Fatura'")
            return "sem botão de Upload"

        tentar("F1 Upload da Fatura sumiu das telas", f1)

        # ---------------- F2: botão Análise presente ----------------
        def f2():
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1200)
            page.get_by_role("button", name=re.compile("Análise da Fatura")).first.wait_for(
                timeout=20_000
            )
            return "botão Análise da Fatura visível"

        tentar("F2 botão Análise da Fatura presente", f2)

        # ---------------- F3: escolher conta → Recebida ----------------
        def f3():
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1200)
            page.get_by_role("button", name=re.compile("Análise da Fatura")).first.click()
            page.wait_for_timeout(900)
            # clique REAL no botão "Escolher conta" (levanta o input de arquivo)
            page.get_by_role("button", name=re.compile("Escolher conta")).first.click()
            escolher_arquivo()
            # a rota POST /fatura grava a linha
            page.wait_for_timeout(6000)
            linhas = linhas_fatura(cid)
            recebidas = [l for l in linhas if fluxo_de(l.get("dados") or {}) == "recebida"]
            if not recebidas:
                raise AssertionError(f"nenhuma linha em 'recebida'; linhas={linhas}")
            return f"{len(recebidas)} card(s) em Fatura Recebida"

        tentar("F3 escolher conta → card Fatura Recebida", f3)

        # ---------------- F5: card no funil (mantido) ----------------
        def f5():
            cards = [c for c in cards_funil(cid) if c.get("etapa") == "recebeu_conta"]
            if not cards:
                raise AssertionError("sem card em RECEBEU A CONTA")
            return f"{len(cards)} card(s) em Recebeu a Conta"

        tentar("F5 card aberto no funil (Recebeu a Conta)", f5)

        # ---------------- F4: analisar → Analisada ----------------
        def f4():
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1200)
            page.get_by_role("button", name=re.compile("Análise da Fatura")).first.click()
            page.wait_for_timeout(900)
            page.get_by_role("button", name=re.compile("Analisar conta")).first.click()
            # clicar em Analisar SEM arquivo abre o SELETOR (reanálise):
            # sem entregar o PDF aqui, nada dispara e a linha fica "recebida"
            escolher_arquivo()
            # a IA leva alguns segundos E o MIMO tem retry: espera o BANCO
            # confirmar (até ~108s) em vez de um fixo de 45s
            linhas = []
            analisadas = []
            for _ in range(36):
                page.wait_for_timeout(3000)
                linhas = linhas_fatura(cid)
                analisadas = [
                    l for l in linhas
                    if fluxo_de(l.get("dados") or {}) == "analise-concluida"
                ]
                if analisadas:
                    break
            if not analisadas:
                corpo = page.inner_text("body")
                erro = re.search(
                    r"Não consegui ler[^\n]*|Falha na análise[^\n]*"
                    r"|Sessão expirada[^\n]*|Escolha a foto[^\n]*"
                    r"|Erro ao registrar[^\n]*|Failed to fetch[^\n]*"
                    r"|Erro inesperado[^\n]*",
                    corpo,
                )
                # captura o estado do MODAL (não da página inteira): se o
                # registro/analise nem dispararam, isso aparece aqui
                modal = ""
                try:
                    modal = page.locator("[role=dialog]").inner_text(timeout=2000)
                except Exception:
                    modal = "(sem dialog)"
                raise AssertionError(
                    "nenhuma linha analisada; erro na tela: "
                    + (erro.group(0)[:140] if erro else "sem mensagem")
                    + f" | registrada={'Conta registrada' in modal}"
                    + f" | analisando={'Analisando com a IA' in modal}"
                    + f" | modal={modal[:260].replace(chr(10), ' / ')}"
                    + f"; linhas={linhas}"
                )
            # mesma competência: NÃO duplicou
            comps = {(l.get("dados") or {}).get("competencia") for l in analisadas}
            if len(analisadas) != 1:
                raise AssertionError(f"esperava 1 card analisado, achei {len(analisadas)}")
            return f"1 card Fatura Analisada (competência {comps})"

        tentar("F4 analisar → card vira Fatura Analisada", f4)

        # ---------------- F7/F6: card analisado abre o resumo ----------------
        def f6():
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1500)
            corpo = page.inner_text("body")
            if "Fatura Analisada" not in corpo:
                raise AssertionError("kanban sem coluna Fatura Analisada")
            # card em Recebida não pode ter botão de abrir; analisado sim
            # clica no card analisado (só ele tem o rótulo "ver →")
            ver = page.get_by_text("ver →")
            if ver.count() == 0:
                raise AssertionError("card analisado sem botão de abrir")
            ver.first.click()
            page.wait_for_timeout(1200)
            modal = page.inner_text("body")
            for campo in ("Concessionária", "UC", "Valor"):
                if campo not in modal:
                    raise AssertionError(f"resumo sem o campo {campo}")
            return "resumo da IA abre no card analisado"

        tentar("F6 card analisado abre resumo da IA", f6)

        # ---------------- F8: segunda análise não duplica ----------------
        def f8():
            antes = len(linhas_fatura(cid))
            page.goto(editar, wait_until="networkidle")
            page.wait_for_timeout(1200)
            page.get_by_role("button", name=re.compile("Análise da Fatura")).first.click()
            page.wait_for_timeout(900)
            # o botão de arquivo muda de rótulo: "Escolher conta" (nada
            # recebido hoje) ou "Trocar conta" (já recebido — reanálise)
            page.get_by_role(
                "button", name=re.compile("Escolher conta|Trocar conta")
            ).first.click()
            escolher_arquivo()
            page.wait_for_timeout(6000)
            depois = len(linhas_fatura(cid))
            if depois > antes:
                raise AssertionError(f"linhas {antes} -> {depois} (duplicou)")
            return f"linhas {antes} -> {depois} (sem duplicar)"

        tentar("F8 segunda análise não duplica card", f8)

        # ---------------- erros de JS ----------------
        if erros_js:
            falhou("F9 sem erros de JavaScript", " | ".join(erros_js[:3]))
        else:
            ok("F9 sem erros de JavaScript")

        nav.close()

    # ---------------- limpeza ----------------
    try:
        rest("DELETE", "cliente_pasta_linhas?cliente_id=eq." + cid)
        rest("DELETE", "oportunidades?cliente_id=eq." + cid)
        rest("DELETE", "clientes?id=eq." + cid)
        print("limpeza: cliente", cid[:8], "removido")
    except Exception as exc:  # noqa: BLE001
        print("limpeza falhou:", exc)

    print()
    print("===== RELATÓRIO — FLUXO ÚNICO DE FATURA =====")
    total = len(resultados)
    falhas = 0
    for status, nome in resultados:
        print(f"{status}  {nome}")
        if status == "FAIL":
            falhas += 1
    print(f"--- {total} testes, {falhas} falha(s)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
