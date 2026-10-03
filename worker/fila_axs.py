#!/usr/bin/env python3
"""
fila_axs.py — processador da fila de propostas AXS (Fase 3 / C3 do
docs/plano-acao-modulos.md).

O form do CRM não dispara mais na hora: ele grava em `fila_propostas_axs`
e este módulo, rodando dentro do mesmo processo do worker de disparo,
envia para `POST /api/axs/send`, acompanha o job e só então marca `criada`.
O que antes morria em 502 sem deixar rastro agora tem estado, backoff,
notificação no sino e botão "tentar de novo" na tela /fila-axs.

Contrato (igual ao resto do worker: I/O só por `deps` injetado, testável
sem rede — ver worker/test_fila_axs.py):

  deps = {
    "buscar"(agora, limite)      -> list[dict]  itens vencidos
    "enviar"(item)               -> (http, corpo)
    "consultar"(job_id)          -> (http, corpo)
    "atualizar"(item_id, patch)  -> None
    "notificar"(item, erro)      -> None   (best effort)
    "avancar_funil"(item)        -> bool   (best effort)
  }

Somente stdlib (sem pip).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import axs_api

# ─── configuração ─────────────────────────────────────────────────────

AXS_ARP_EMAIL = os.environ.get("AXS_ARP_EMAIL", "").strip()
AXS_ARP_SENHA = os.environ.get("AXS_ARP_SENHA", "").strip()
APP_URL = (
    os.environ.get("STK_APP_URL") or "https://stk-crm-amber-delta.vercel.app"
).rstrip("/")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BACKOFF_BASE_SEG = int(os.environ.get("FILA_BACKOFF_BASE_SEG", "60"))
BACKOFF_MAX_SEG = int(os.environ.get("FILA_BACKOFF_MAX_SEG", "900"))
MAX_TENTATIVAS_PADRAO = int(os.environ.get("FILA_MAX_TENTATIVAS", "6"))
LIMITE_CICLO = int(os.environ.get("FILA_LIMITE_CICLO", "5"))
TIMEOUT_SEG = float(os.environ.get("FILA_TIMEOUT_SEG", "20"))

# de quanto em quanto tempo o worker olha a fila / re-consulta um job aberto
INTERVALO_CICLO_SEG = int(os.environ.get("FILA_POLL_SECONDS", "15"))
INTERVALO_CONSULTA_SEG = 15

# retroalimentação do funil (espelha lib/axs/fila.ts)
ETAPAS_QUE_AVANCAM = ("recebeu_conta", "proposta_a_fazer")
ETAPA_RETROALIMENTO = "proposta_feita"

STATUS_RESOLVIDOS = ("criada", "manual", "erro")


# ─── tempo ────────────────────────────────────────────────────────────

def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(valor) -> datetime | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        dt = valor
    else:
        try:
            dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def backoff_segundos(tentativas) -> int:
    """60s, 120s, 240s... até BACKOFF_MAX_SEG. Nunca negativo."""
    try:
        n = int(tentativas)
    except (TypeError, ValueError):
        return 0
    if n <= 0:
        return 0
    return min(BACKOFF_BASE_SEG * (2 ** (n - 1)), BACKOFF_MAX_SEG)


def deve_avancar_etapa(etapa) -> bool:
    """Só etapas ANTERIORES à proposta — o funil nunca retrocede."""
    return bool(etapa) and etapa in ETAPAS_QUE_AVANCAM


# ─── máquina de estados ───────────────────────────────────────────────

def decisao(item: dict, agora: datetime) -> dict | None:
    """O que fazer com este item AGORA. None = nada a fazer."""
    status = (item or {}).get("status")

    if status in STATUS_RESOLVIDOS:
        return None

    max_tentativas = int(item.get("max_tentativas") or MAX_TENTATIVAS_PADRAO)
    tentativas = int(item.get("tentativas") or 0)
    job_id = item.get("job_id")

    if status == "enviando":
        if job_id:
            return {"acao": "consultar"}
        if tentativas >= max_tentativas:
            return {"acao": "falhar", "erro": "envio sem job para acompanhar"}
        return {"acao": "enviar"}

    # pendente (ou status inesperado tratado como pendente)
    if tentativas >= max_tentativas:
        return {"acao": "falhar", "erro": "limite de tentativas atingido"}
    proxima = _parse(item.get("proxima_tentativa"))
    if proxima is not None and proxima > agora:
        return None
    if job_id:
        # já existe um job aberto: consulta em vez de criar duplicata
        return {"acao": "consultar"}
    return {"acao": "enviar"}


def ler_resultado_job(corpo) -> str:
    """'ok' | 'falhou' | 'rodando' — tolerante ao formato da AXS."""
    if not isinstance(corpo, dict):
        return "rodando"
    for chave in ("status", "estado", "state", "result", "resultado"):
        valor = corpo.get(chave)
        if isinstance(valor, str):
            v = valor.strip().lower()
            if v in ("ok", "success", "succeeded", "completed", "complete",
                     "done", "created", "criada"):
                return "ok"
            if v in ("error", "erro", "failed", "failure", "falhou", "cancel"):
                return "falhou"
            if v:
                return "rodando"
    if corpo.get("card_id") or corpo.get("axs_card_id") or corpo.get("idCard"):
        return "ok"
    return "rodando"


def _mensagem_erro(corpo, padrao: str) -> str:
    if isinstance(corpo, dict):
        for chave in ("error", "erro", "message", "mensagem", "detail"):
            valor = corpo.get(chave)
            if valor:
                return str(valor)[:300]
    return padrao


def transicao_falha(item: dict, erro: str, agora: datetime) -> dict:
    """Tentativa que não deu em criação: conta a tentativa e faz backoff."""
    max_tentativas = int(item.get("max_tentativas") or MAX_TENTATIVAS_PADRAO)
    novas = int(item.get("tentativas") or 0) + 1
    patch = {
        "erro": erro[:500],
        "tentativas": novas,
        "ultima_tentativa_em": _iso(agora),
    }
    if novas >= max_tentativas:
        patch["status"] = "erro"
        return patch
    patch["status"] = "enviando" if item.get("job_id") else "pendente"
    patch["proxima_tentativa"] = _iso(agora + timedelta(seconds=backoff_segundos(novas)))
    return patch


def transicao_envio(item: dict, http: int, corpo, agora: datetime) -> dict:
    """Resultado de POST /api/axs/send."""
    max_tentativas = int(item.get("max_tentativas") or MAX_TENTATIVAS_PADRAO)
    novas = int(item.get("tentativas") or 0) + 1

    if isinstance(http, int) and 200 <= http < 300:
        corpo = corpo if isinstance(corpo, dict) else {}
        if corpo.get("job_id"):
            return {
                "status": "enviando",
                "job_id": str(corpo["job_id"]),
                "tentativas": novas,
                "erro": None,
                "proxima_tentativa": _iso(agora + timedelta(seconds=INTERVALO_CONSULTA_SEG)),
                "ultima_tentativa_em": _iso(agora),
            }
        if ler_resultado_job(corpo) == "ok":
            # API da AXS devolve {idCard}; o robô antigo devolvia card_id.
            # `parcial` (criado mas etapa falhou) fica no campo `erro` de propósito:
            # é para a tela mostrar "criada, com pendência" — não repetir o criar.
            return {
                "status": "criada",
                "criada_em": _iso(agora),
                "axs_card_id": str(corpo.get("card_id") or corpo.get("axs_card_id")
                                   or corpo.get("idCard") or ""),
                "tentativas": novas,
                "erro": (str(corpo["erro"])[:500] if corpo.get("erro") else None),
                "ultima_tentativa_em": _iso(agora),
            }

    erro = _mensagem_erro(corpo, f"HTTP {http} ao enviar para AXS")
    if novas >= max_tentativas:
        return {
            "status": "erro",
            "erro": erro[:500],
            "tentativas": novas,
            "ultima_tentativa_em": _iso(agora),
        }
    return transicao_falha(item, erro, agora)


def transicao_job(item: dict, http: int, corpo, agora: datetime) -> dict:
    """Resultado de GET /api/axs/send?job_id=..."""
    max_tentativas = int(item.get("max_tentativas") or MAX_TENTATIVAS_PADRAO)
    novas = int(item.get("tentativas") or 0) + 1
    job_id = item.get("job_id")

    if not (isinstance(http, int) and 200 <= http < 300):
        erro = _mensagem_erro(corpo, f"HTTP {http} ao consultar o job")
        if novas >= max_tentativas:
            return {"status": "erro", "erro": erro[:500], "tentativas": novas,
                    "job_id": job_id, "ultima_tentativa_em": _iso(agora)}
        return {
            "status": item.get("status") or "enviando",
            "job_id": job_id,
            "tentativas": novas,
            "erro": erro[:500],
            "proxima_tentativa": _iso(agora + timedelta(seconds=backoff_segundos(novas))),
            "ultima_tentativa_em": _iso(agora),
        }

    corpo = corpo if isinstance(corpo, dict) else {}
    resultado = ler_resultado_job(corpo)

    if resultado == "ok":
        return {
            "status": "criada",
            "criada_em": _iso(agora),
            "axs_card_id": str(corpo.get("card_id") or corpo.get("axs_card_id") or ""),
            "erro": None,
            "ultima_tentativa_em": _iso(agora),
        }

    if resultado == "falhou":
        erro = _mensagem_erro(corpo, "job da AXS terminou com falha")
        if novas >= max_tentativas:
            return {"status": "erro", "erro": erro[:500], "tentativas": novas,
                    "job_id": None, "ultima_tentativa_em": _iso(agora)}
        # job morto: limpa o id para que o próximo ciclo REENVIE de verdade
        return {
            "status": "pendente",
            "job_id": None,
            "tentativas": novas,
            "erro": erro[:500],
            "proxima_tentativa": _iso(agora + timedelta(seconds=backoff_segundos(novas))),
            "ultima_tentativa_em": _iso(agora),
        }

    # ainda rodando (ou formato desconhecido): consulta de novo daqui a pouco
    if novas >= max_tentativas:
        return {"status": "erro", "erro": "job da AXS não terminou no prazo",
                "tentativas": novas, "job_id": job_id, "ultima_tentativa_em": _iso(agora)}
    return {
        "status": "enviando",
        "job_id": job_id,
        "tentativas": novas,
        "erro": None,
        "proxima_tentativa": _iso(agora + timedelta(seconds=INTERVALO_CONSULTA_SEG)),
        "ultima_tentativa_em": _iso(agora),
    }


# ─── ciclo ────────────────────────────────────────────────────────────

def _fn(deps, nome: str):
    """`deps` pode ser dict ou objeto com atributos — o teste usa objeto."""
    fn = deps.get(nome) if isinstance(deps, dict) else getattr(deps, nome, None)
    if fn is None:
        raise KeyError(f"deps sem '{nome}'")
    return fn


def _seguro(fn, *args):
    """Efeito colateral best-effort: notificação/funil nunca derrubam o ciclo."""
    try:
        return fn(*args)
    except Exception:
        return None


def _fn_opcional(deps, nome: str):
    """Dep novo é opcional: teste/instalação antiga sem ele não quebra."""
    return deps.get(nome) if isinstance(deps, dict) else getattr(deps, nome, None)


def _para_valor(v):
    """Mensalidade da AXS -> float. '767,88' / '1.234,56' / 812.5 / lixo."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace(" ", "")
    if not s:
        return None
    try:
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        return float(s)
    except ValueError:
        return None


def _processar_item(item: dict, agora: datetime, deps: dict) -> dict:
    base = {"id": (item or {}).get("id")}

    decisao_item = decisao(item, agora)
    if not decisao_item:
        return {**base, "status": "ignorado"}

    acao = decisao_item["acao"]

    if acao == "falhar":
        patch = {
            "status": "erro",
            "erro": (decisao_item.get("erro") or "limite de tentativas atingido")[:500],
            "ultima_tentativa_em": _iso(agora),
        }
        _fn(deps, "atualizar")(item["id"], patch)
        _seguro(_fn(deps, "notificar"), item, patch["erro"])
        return {**base, "status": "erro", "erro": patch["erro"]}

    if acao == "consultar":
        http, corpo = _fn(deps, "consultar")(item.get("job_id"))
        patch = transicao_job(item, http, corpo, agora)
    else:
        http, corpo = _fn(deps, "enviar")(item)
        patch = transicao_envio(item, http, corpo, agora)

    _fn(deps, "atualizar")(item["id"], patch)
    status = patch.get("status")

    if status == "criada":
        _seguro(_fn(deps, "avancar_funil"), item)
        # Passo 9 do guia: a AXS devolve mensalidade_axs no criar/card.
        # Antes este valor era DERRUBADO (só o idCard era guardado) e a tela
        # /fila-axs nunca mostrava R$.
        valor = _para_valor((corpo or {}).get("mensalidade_axs")
                            or (corpo or {}).get("mensalidade"))
        salvar = _fn_opcional(deps, "salvar_mensalidade")
        if valor is not None and salvar is not None:
            _seguro(salvar, item, valor)
    elif status == "erro":
        _seguro(_fn(deps, "notificar"), item, patch.get("erro") or "falhou")

    return {**base, "status": status, "erro": patch.get("erro"),
            "job_id": patch.get("job_id")}


def processar_fila(agora: datetime | None = None, deps: dict | None = None,
                   limite: int | None = None) -> list:
    """
    Roda os itens vencidos da fila. NUNCA lança exceção: devolve um
    relatório (mesma filosofia de `agendador.executar_rotinas`).
    """
    agora = agora or datetime.now(timezone.utc)
    deps = deps_reais() if deps is None else deps
    limite = limite or LIMITE_CICLO

    try:
        itens = _fn(deps, "buscar")(agora, limite) or []
    except Exception as e:
        return [{"status": "erro_ciclo", "erro": f"{type(e).__name__}: {e}"}]

    relatorio: list = []
    for item in itens:
        try:
            relatorio.append(_processar_item(item, agora, deps))
        except Exception as e:
            # nunca deixa uma falha de rede segurar o resto da fila
            erro = f"{type(e).__name__}: {e}"
            patch = transicao_falha(item or {}, erro, agora)
            try:
                _fn(deps, "atualizar")((item or {}).get("id"), patch)
                if patch.get("status") == "erro":
                    _seguro(_fn(deps, "notificar"), item, patch.get("erro"))
            except Exception:
                pass
            relatorio.append({"id": (item or {}).get("id"), "status": "erro",
                              "erro": erro})
    return relatorio


# ─── I/O real (Supabase + /api/axs/send) ──────────────────────────────

def _requisitar(url: str, metodo: str = "GET", corpo=None,
                timeout: float | None = None) -> tuple[int, dict]:
    """(http_status, json). Nunca lança: 0 = bloqueio de rede."""
    dados = None
    headers = {"Accept": "application/json"}
    if corpo is not None:
        dados = json.dumps(corpo).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=dados, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout or TIMEOUT_SEG) as resp:
            texto = resp.read().decode("utf-8", "replace")
            return resp.status, _json(texto)
    except urllib.error.HTTPError as e:
        texto = ""
        try:
            texto = e.read().decode("utf-8", "replace")
        except Exception:
            pass
        return e.code, _json(texto) or {"error": f"HTTP {e.code}"}
    except Exception as e:
        return 0, {"error": f"{type(e).__name__}: {e}"}


def _json(texto: str) -> dict | list:
    if not texto:
        return {}
    try:
        return json.loads(texto)
    except ValueError:
        return {"error": texto[:300]}


_AVISO_TABELA = {"visto": False}


def _supa_status(metodo: str, tabela: str, params: dict | None = None,
                 corpo=None) -> tuple[int, object]:
    """PostgREST com service role. (status, linhas) — 0 = bloqueio."""

    if not SUPABASE_URL or not SUPABASE_KEY:
        return 0, []
    url = f"{SUPABASE_URL}/rest/v1/{tabela}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {
        "Accept": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "return=representation",
    }
    dados = None
    if corpo is not None:
        dados = json.dumps(corpo).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=dados, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEG) as resp:
            return resp.status, _json(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        texto = ""
        try:
            texto = e.read().decode("utf-8", "replace")
        except Exception:
            pass
        return e.code, _json(texto)
    except Exception:
        return 0, []


def _supa(metodo: str, tabela: str, params: dict | None = None, corpo=None) -> list:
    """PostgREST com service role. Retorna a lista de linhas ([] em erro)."""
    _, dados = _supa_status(metodo, tabela, params, corpo)
    return dados if isinstance(dados, list) else []


def _buscar(agora: datetime, limite: int) -> list:
    status, dados = _supa_status("GET", "fila_propostas_axs", {
        "status": "in.(pendente,enviando)",
        "proxima_tentativa": f"lte.{_iso(agora)}",
        "order": "proxima_tentativa.asc",
        "limit": str(limite),
        "select": "*",
    })
    if status >= 400 and not _AVISO_TABELA["visto"]:
        _AVISO_TABELA["visto"] = True
        print(f"[Fila AXS] fila_propostas_axs indisponível (HTTP {status}) — aplicar "
              "supabase/migrations/091_fila_propostas_axs.sql no SQL Editor.",
              file=sys.stderr)
    return dados if isinstance(dados, list) else []


def _enviar(item: dict) -> tuple[int, dict]:
    """Cria a proposta na AXS pelo fluxo ARP (login + criar/card)."""
    if not AXS_ARP_EMAIL or not AXS_ARP_SENHA:
        return 500, {"error": "AXS_ARP_EMAIL/AXS_ARP_SENHA não configurados "
                              "no env do worker"}
    credenciais = {"email": AXS_ARP_EMAIL, "senha": AXS_ARP_SENHA}
    return axs_api.criar_da_fila(item, credenciais)


def _consultar(job_id: str) -> tuple[int, dict]:
    return _requisitar(
        f"{APP_URL}/api/axs/send?{urllib.parse.urlencode({'job_id': job_id})}", "GET"
    )


def _atualizar(item_id, patch: dict) -> None:
    if not item_id:
        return
    _supa("PATCH", "fila_propostas_axs", {"id": f"eq.{item_id}"}, patch)


def _notificar(item: dict, erro) -> None:
    vendedor = item.get("vendedor_id")
    if not vendedor:
        return
    _supa("POST", "notificacoes", None, {
        "user_id": vendedor,
        "tipo": "fila_proposta_axs",
        "titulo": "Proposta AXS não foi criada",
        "mensagem": (
            f"A proposta do cliente {item.get('cliente_id')} esgotou as "
            f"tentativas ({item.get('tentativas')}): {erro}"
        ),
        "dados": {
            "fila_id": item.get("id"),
            "cliente_id": item.get("cliente_id"),
            "erro": str(erro)[:300],
        },
    })


def _avancar_funil(item: dict) -> bool:
    """Retroalimentação do funil: criação confirmada -> proposta_feita."""
    oportunidade_id = item.get("oportunidade_id")
    if not oportunidade_id:
        return False

    linhas = _supa("GET", "oportunidades", {
        "id": f"eq.{oportunidade_id}",
        "select": "id,etapa",
        "limit": "1",
    })
    if not linhas:
        return False

    etapa = linhas[0].get("etapa")
    if not deve_avancar_etapa(etapa):
        return False

    atualizadas = _supa("PATCH", "oportunidades",
                        {"id": f"eq.{oportunidade_id}", "etapa": f"eq.{etapa}"},
                        {"etapa": ETAPA_RETROALIMENTO})
    if not atualizadas:
        return False

    _supa("POST", "oportunidade_historico", None, {
        "oportunidade_id": oportunidade_id,
        "etapa_anterior": etapa,
        "etapa_nova": ETAPA_RETROALIMENTO,
        "observacao": "Proposta criada na AXS pela fila do CRM",
    })
    return True


def _salvar_mensalidade(item: dict, valor: float) -> None:
    """Grava a mensalidade devolvida pela AXS no cliente (coluna que já
    existe desde a migration 077 — sem migration nova)."""
    cliente_id = item.get("cliente_id")
    if not cliente_id:
        return
    _supa("PATCH", "clientes", {"id": f"eq.{cliente_id}"},
          {"axs_mensalidade": valor})


def deps_reais() -> dict:
    return {
        "buscar": _buscar,
        "enviar": _enviar,
        "consultar": _consultar,
        "atualizar": _atualizar,
        "notificar": _notificar,
        "avancar_funil": _avancar_funil,
        "salvar_mensalidade": _salvar_mensalidade,
    }
