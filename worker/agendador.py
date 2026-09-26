#!/usr/bin/env python3
"""
agendador.py — agendador único do STK-CRM (F0.2 do docs/plano-acao-modulos.md).

Por que aqui e não em Vercel Cron/pg_cron: o worker Python já é o único
processo periódico vivo do sistema (poll de 5s na VPS via Supervisor) e já
sabe falar com Supabase e WAHA. Uma rotina = uma linha em `worker_rotinas`;
ligar/desligar não exige deploy nem editar código.

Contrato:
  - `deve_executar(rotina, agora)`      → puro, testável
  - `executar_rotinas(...)`            → orquestra; TODA I/O entra por
                                          callables injetadas (salvar/handlers)
  - `dry_run=True` é o PADRÃO: nada é persistido até quem chamar pedir
                                          explicitamente dry_run=False.

Somente stdlib (sem pip), como o resto do worker.
"""

from datetime import datetime, timedelta, timezone

INTERVALO_PADRAO_HORAS = 24.0

# nome -> {"descricao": str, "handler": callable(rotina, agora, ctx) -> dict}
ROTINAS: dict = {}


def registrar(nome: str, descricao: str, handler) -> None:
    ROTINAS[nome] = {"descricao": descricao, "handler": handler}


# ─── tempo ────────────────────────────────────────────────────────────

def _parse_quando(valor) -> datetime | None:
    """Aceita datetime, ISO do PostgREST ('...+00:00' / '...Z') ou None."""
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


def proxima_execucao(base, intervalo_horas) -> datetime:
    base_dt = _parse_quando(base) or datetime.now(timezone.utc)
    try:
        horas = float(intervalo_horas)
    except (TypeError, ValueError):
        horas = 0.0
    if horas <= 0:
        horas = INTERVALO_PADRAO_HORAS
    return base_dt + timedelta(hours=horas)


def _ativo(valor) -> bool:
    """PostgREST devolve boolean como bool, mas aceitamos 'true'/1 por segurança."""
    if isinstance(valor, str):
        return valor.strip().lower() in ("true", "t", "1", "yes", "y")
    return bool(valor)


def deve_executar(rotina: dict, agora: datetime) -> bool:
    if not _ativo(rotina.get("ativa")):
        return False
    prox = _parse_quando(rotina.get("proxima_execucao"))
    if prox is None:
        return True          # primeira execução (registro recém-criado)
    return prox <= agora


# ─── executor ─────────────────────────────────────────────────────────

def executar_rotinas(
    rotinas: list,
    agora: datetime,
    handlers: dict | None = None,
    ctx: dict | None = None,
    dry_run: bool = True,
    salvar=None,
) -> list:
    """
    Roda as rotinas vencidas. Retorna um relatório (nunca lança exceção).

    dry_run=True (padrão): só imprime o plano — NÃO persiste `ultima_execucao`,
    para não "consumir" a execução real.
    """
    handlers = handlers if handlers is not None else dict(ROTINAS)
    handlers = {k: (v["handler"] if isinstance(v, dict) and "handler" in v else v)
                for k, v in handlers.items()}
    ctx = ctx or {}
    relatorio: list = []

    for rotina in rotinas or []:
        nome = (rotina or {}).get("nome") or ""
        base = {"id": rotina.get("id"), "nome": nome}

        if not deve_executar(rotina, agora):
            relatorio.append({**base, "status": "ignorada"})
            continue

        handler = handlers.get(nome)
        if not handler:
            relatorio.append({**base, "status": "sem_handler",
                              "erro": "rotina vencida sem handler registrado"})
            continue

        try:
            plano = handler(rotina, agora, ctx) or {}
        except Exception as e:  # nunca derrubar o lote por 1 rotina
            relatorio.append({**base, "status": "erro", "erro": f"{type(e).__name__}: {e}"})
            continue

        resumo = plano.get("resumo", "") if isinstance(plano, dict) else str(plano)

        if dry_run:
            relatorio.append({**base, "status": "dry_run", "resumo": resumo})
            continue

        if salvar:
            salvar(
                rotina.get("id"),
                {
                    "ultima_execucao": agora.isoformat(),
                    "proxima_execucao": proxima_execucao(
                        agora, rotina.get("intervalo_horas")
                    ).isoformat(),
                },
            )
        relatorio.append({**base, "status": "ok", "resumo": resumo})

    return relatorio


def formatar_relatorio(relatorio: list) -> str:
    if not relatorio:
        return "[Agendador] nada no lote"
    linhas = []
    for r in relatorio:
        linha = f"[Agendador] {r.get('nome')} -> {r.get('status')}"
        if r.get("resumo"):
            linha += f" | {r['resumo']}"
        if r.get("erro"):
            linha += f" | ERRO: {r['erro']}"
        linhas.append(linha)
    return "\n".join(linhas)
