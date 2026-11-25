#!/usr/bin/env python3
"""Teste de usabilidade da REORGANIZAÇÃO DO DISPARO (25/11/2026) — Playwright
com cliques reais (sem API).

Cobre a entrega de hoje (docs/plano-reorganizacao-disparo.md, seção 4):
  1  /disparo abre em abas e mostra as 4 seções da proposta
  2  Visão Geral = Painel de Envios com os 4 indicadores reais
  3  Clique em "Disparos" → histórico + botão "Novo Disparo"
  4  Clique em "Relatórios" → conteúdo de relatório renderiza
  5  Clique em "Configurações" → sessões WhatsApp reais (GET /api/instances)
  6  Voltar para "Visão Geral" → painel continua lá (ida e volta)
  7  Nenhum erro de JS no console durante a navegação
  8  Sidebar continua com o item "Disparo"

Uso:
  STK_BASE_URL=http://localhost:3000 python3 tests/usabilidade/teste_usabilidade_disparo.py

Pré-condição: cookie de sessão em /root/.hermes/cache/scratch/sessao-stk.json
(formato {"cookies": "nome=valor; ..."}) — mesma convenção do
teste_usabilidade.py.

Saída: linhas "PASS/FAIL <teste> — <detalhe>" e exit 1 se algo falhar.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.parse

from playwright.sync_api import sync_playwright

BASE = os.environ.get("STK_BASE_URL", "http://localhost:3000")
SESSAO_ARQ = pathlib.Path("/root/.hermes/cache/scratch/sessao-stk.json")
COOKIE_NOME = "sb-nizreygwaqqojwrorpqo-auth-token"

resultados: list[tuple[str, str, str]] = []
erros_js: list[str] = []


def passou(nome: str, detalhe: str = "") -> None:
    resultados.append(("PASS", nome, detalhe))


def falhou(nome: str, detalhe: str) -> None:
    resultados.append(("FAIL", nome, detalhe))


def tentar(nome: str, fn):
    try:
        detalhe = fn() or ""
        passou(nome, detalhe)
    except AssertionError as e:
        falhou(nome, f"asserção: {e}")
    except Exception as e:  # noqa: BLE001 — a bateria não pode parar no meio
        falhou(nome, f"{type(e).__name__}: {str(e)[:220]}")


def main() -> int:
    sessao = json.loads(SESSAO_ARQ.read_text())
    cookie_valor = None
    for parte in sessao.get("cookies", "").split(";"):
        if parte.strip().startswith(COOKIE_NOME + "="):
            cookie_valor = parte.split("=", 1)[1].strip()
    if not cookie_valor:
        print("SESSÃO INVÁLIDA — refaça o login.")
        return 2

    with sync_playwright() as pw:
        nav = pw.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies(
            [
                {
                    "name": COOKIE_NOME,
                    "value": cookie_valor,
                    "domain": urllib.parse.urlparse(BASE).netloc,
                    "path": "/",
                    "httpOnly": False,
                    "secure": BASE.startswith("https"),
                }
            ]
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: erros_js.append(str(e)[:220]))

        # ---------------------------------------------------------- 1 + 2
        page.goto(f"{BASE}/disparo", wait_until="networkidle")
        page.wait_for_timeout(800)

        def abas():
            abas_el = page.get_by_role("tab")
            nomes = [a.inner_text().strip() for a in abas_el.all()]
            assert len(nomes) == 4, f"esperava 4 abas, achei {len(nomes)}: {nomes}"
            esperadas = ["Visão Geral", "Disparos", "Relatórios", "Configurações"]
            for e in esperadas:
                assert any(e.lower() in n.lower() for n in nomes), (
                    f"aba '{e}' ausente em {nomes}"
                )
            return f"abas: {nomes}"

        tentar("1 abre /disparo com as 4 seções da proposta", abas)

        def painel():
            for indicador in [
                "Mensagens enviadas",
                "Falhas",
                "Taxa de sucesso",
                "Em andamento",
            ]:
                assert page.get_by_text(indicador, exact=False).first.is_visible(), (
                    f"indicador '{indicador}' não visível"
                )
            # a aba ativa é a Visão Geral
            ativa = page.get_by_role("tab", selected=True).inner_text()
            assert "Visão Geral" in ativa, f"aba ativa inicial era '{ativa}'"
            return "4 indicadores visíveis na Visão Geral"

        tentar("2 Visão Geral mostra o Painel de Envios com indicadores", painel)

        # ------------------------------------------------------------- 3
        def disparos():
            page.get_by_role("tab", name="Disparos").click()
            page.wait_for_timeout(900)
            botao = page.get_by_role("button", name="Novo Disparo")
            assert botao.first.is_visible(), "botão 'Novo Disparo' ausente"
            # só uma aba ativa (as outras desmontam)
            assert page.get_by_text("Mensagens enviadas").count() == 0, (
                "painel da Visão Geral continua montado na aba Disparos"
            )
            return "histórico + 'Novo Disparo' renderizam; Visão Geral desmontou"

        tentar("3 clique em 'Disparos' abre histórico e Novo Disparo", disparos)

        # ------------------------------------------------------------- 4
        def relatorios():
            page.get_by_role("tab", name="Relatórios").click()
            page.wait_for_timeout(900)
            corpo = page.locator('[role="tabpanel"]').inner_text()
            assert len(corpo.strip()) > 40, f"relatório vazio: {corpo[:80]!r}"
            return f"{len(corpo.strip())} caracteres de relatório"

        tentar("4 clique em 'Relatórios' renderiza o conteúdo", relatorios)

        # ------------------------------------------------------------- 5
        def configs():
            page.get_by_role("tab", name="Configurações").click()
            page.wait_for_timeout(1500)
            corpo = page.locator('[role="tabpanel"]').inner_text()
            assert "WhatsApp" in corpo or "sess" in corpo.lower(), (
                f"painel de sessões não renderizou: {corpo[:120]!r}"
            )
            abertas = "✅ Aberta" in corpo
            fechadas = "❌ Fechada" in corpo
            assert abertas or fechadas, f"nenhum status de sessão em: {corpo[:160]!r}"
            return f"sessões listadas (aberta={abertas}, fechada={fechadas})"

        tentar("5 Configurações lista as sessões WhatsApp reais", configs)

        # ------------------------------------------------------------- 6
        def volta():
            page.get_by_role("tab", name="Visão Geral").click()
            page.wait_for_timeout(900)
            assert page.get_by_text("Mensagens enviadas").first.is_visible(), (
                "painel não voltou ao clicar em Visão Geral"
            )
            return "ida e volta funcionando"

        tentar("6 voltar para 'Visão Geral' restaura o painel", volta)

        # ------------------------------------------------------------- 7
        def sem_erro_js():
            assert not erros_js, f"erros de JS: {erros_js[:3]}"
            return "nenhum pageerror durante a navegação"

        tentar("7 nenhum erro de JS no console", sem_erro_js)

        # ------------------------------------------------------------- 8
        def sidebar():
            item = page.get_by_role("link", name="Disparo").first
            assert item.is_visible(), "item 'Disparo' sumiu do menu"
            return "menu lateral intacto"

        tentar("8 sidebar continua com o item 'Disparo'", sidebar)

        nav.close()

    print()
    for status, nome, detalhe in resultados:
        print(f"{status} {nome} — {detalhe}")
    falhas = sum(1 for s, _, _ in resultados if s == "FAIL")
    print(f"\n{len(resultados) - falhas} PASS / {falhas} FAIL")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
