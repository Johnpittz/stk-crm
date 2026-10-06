#!/usr/bin/env python3
"""
disparo_worker_waha.py — Worker de disparo em massa do STK-CRM via WAHA.

Substitui /root/disparo_worker.py (Evolution API) — docs/plano-migracao-waha.md Fase 7.

Comportamento (espelha o worker original documentado em PROGRESSO.MD, Fase 12):
  - Poll a cada 5s no Supabase por bulk_campaigns com status='running'
  - Envia via WAHA (sendText/sendImage) usando a sessão da campanha (instancia)
  - Fluxo de mensagens (fluxo_mensagens: texto/imagem) com intervalo_passos entre passos
  - delay_inicial antes do primeiro contato; intervalo entre contatos
  - Substituição de {{nome}} (lookup em clientes.telefone) e {{telefone}}
  - Contadores sent/failed atualizados por contato; logs em disparo_logs
  - Retoma de onde parou (offset = sent + failed) se reiniciar no meio
  - Respeita status 'paused' (para e continua depois)

Uso:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WAHA_API_URL=... WAHA_API_KEY=... \
    python3 disparo_worker_waha.py

Somente stdlib (sem pip) — roda na VPS (supervisor) ou em qualquer container.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import agendador as agd
import fila_axs

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WAHA_URL = os.environ.get("WAHA_API_URL", "").rstrip("/")
WAHA_KEY = os.environ.get("WAHA_API_KEY", "")
POLL_SECONDS = float(os.environ.get("DISPARO_POLL_SECONDS", "5"))
REQUEST_TIMEOUT = float(os.environ.get("DISPARO_TIMEOUT", "30"))
# F0.2 — agendador único (docs/plano-acao-modulos.md)
AGENDADOR_POLL_SECONDS = float(os.environ.get("DISPARO_AGENDADOR_POLL", "60"))
# Padrão 1 = dry-run (só imprime). Na Fase 0 os handlers são somente-leitura;
# nas Fases 1/2 cada handler ganha o próprio corte de segurança.
AGENDADOR_DRY_RUN = os.environ.get("AGENDADOR_DRY_RUN", "1").strip().lower() not in ("0", "false", "no")


# ─── HTTP helpers (stdlib) ────────────────────────────────────────────

def _http(method: str, url: str, payload=None, headers=None, timeout=REQUEST_TIMEOUT):
    """Retorna (status, body_json_ou_texto). Não lança em HTTPError."""
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw else raw
        except json.JSONDecodeError:
            return e.code, raw
    except Exception as e:  # rede/timeout
        return 0, str(e)


def supabase_rest(method: str, table: str, query: str = "", payload=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}{query}"
    return _http(
        method,
        url,
        payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=representation",
        },
    )


def waha_send(endpoint: str, payload: dict):
    status, body = _http(
        "POST",
        f"{WAHA_URL}/api/{endpoint}",
        payload,
        headers={"X-Api-Key": WAHA_KEY},
    )
    return status, body


# ─── Regras de negócio (testáveis sem rede) ───────────────────────────

def normalizar_digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def formatar_chat_id(telefone: str) -> str:
    d = normalizar_digits(telefone)
    if d and not d.startswith("55") and len(d) <= 11:
        d = "55" + d
    return f"{d}@c.us"


def eh_contato(valor) -> bool:
    """true se o valor parece um telefone (>=10 dígitos).

    Bug 03/10: a tela de campanhas prefixava a instância na lista
    ('STK-3'), o robô formatava em '553@c.us' e a WAHA respondia
    timeout — 1 de 6 falhava no teste do João.
    """
    return len(normalizar_digits(str(valor) if valor is not None else "")) >= 10


def limpar_base64(valor: str) -> str:
    """Remove o prefixo data:...;base64, do FileReader.

    Bug 03/10: a tela grava o passo de imagem COM o prefixo e a WAHA exige
    base64 puro — com o prefixo a decodificação sai corrompida (432.548 bytes
    sem mágica JPEG) e o WhatsApp renderiza a imagem como arquivo de 422 KB.
    """
    return re.sub(r"^data:[^;,]+;base64,", "", valor or "")


def eh_erro_lid(body) -> bool:
    """GOWS (WAHA 2026.9.1) devolve 500 com 'no LID found ...
    @s.whatsapp.net from server' quando o WhatsApp não resolve PN -> LID.
    Bug conhecido: WAHA #1714/#2094/#2214. Derrubou 49 de 50 no disparo
    de 05/10."""
    return "no lid found" in str(body).lower()


def variantes_chat_id(chat_id: str) -> list:
    """[chat_id original, variante BR com/sem o 9 extra] (sem duplicar).

    Número brasileiro é o único com a regra do 9 extra na 5ª posição:
    o WhatsApp ora só resolve a grafia COM o 9, ora só a SEM (wuzapi#243).
    55 + DDD + 9XXXXXXXX -> 55 + DDD + 8XXXXXXXX e vice-versa.
    """
    base = (chat_id or "").strip()
    if not base.endswith("@c.us"):
        return [base] if base else []
    numero = base[: -len("@c.us")]
    variantes = [base]
    # BR: 55 + DDD + 8 (sem o 9 extra) = 12 dígitos; com o 9 = 13.
    if numero.startswith("55") and len(numero) in (12, 13):
        ddd, assinante = numero[2:4], numero[4:]
        if len(assinante) == 9 and assinante.startswith("9"):
            alt = "55" + ddd + assinante[1:]
        elif len(assinante) == 8:
            alt = "55" + ddd + "9" + assinante
        else:
            alt = None
        if alt and alt != numero:
            variantes.append(f"{alt}@c.us")
    return variantes


def enviar_passo(endpoint: str, payload: dict, chat_id: str, enviar=None):
    """Envia um passo; se o GOWS falhar com 'no LID found', repete na
    variante BR do número. Retorna (status, body, chat_id_usado).

    Só insiste na variante quando o erro é de LID — outro erro (rede,
    502) não ganha retry aqui.
    """
    enviar = enviar or waha_send
    status, body = enviar(endpoint, payload)
    if 200 <= status < 300 or not eh_erro_lid(body):
        return status, body, chat_id
    for alt in variantes_chat_id(chat_id)[1:]:
        payload_alt = dict(payload)
        payload_alt["chatId"] = alt
        status, body = enviar(endpoint, payload_alt)
        if 200 <= status < 300:
            return status, body, alt
        if not eh_erro_lid(body):
            break
    return status, body, chat_id


def substituir_variaveis(texto: str, nome: str, telefone: str) -> str:
    """Substitui {{nome}} e {{telefone}} ({{promocao}} já vem resolvido do frontend)."""
    if not texto:
        return texto
    out = texto.replace("{{nome}}", nome or "").replace("{{telefone}}", telefone or "")
    return out


def offset_retomada(campaign: dict) -> int:
    """Contatos já processados = sent + failed (permite retomar após restart)."""
    return int(campaign.get("sent") or 0) + int(campaign.get("failed") or 0)


def montar_passos(campaign: dict) -> list:
    """
    Lista de passos a enviar por contato.
    - fluxo_mensagens presente: usa a sequência [{type, content|url, mimetype}]
    - legado: imagem_url primeiro (se houver) e depois a mensagem texto
    """
    fluxo = campaign.get("fluxo_mensagens")
    if isinstance(fluxo, list) and fluxo:
        passos = []
        for i, p in enumerate(fluxo):
            tipo = (p or {}).get("type")
            if tipo == "text" and p.get("content"):
                passos.append({"type": "text", "content": p["content"], "index": i})
            elif tipo == "image" and (p.get("url") or p.get("base64")):
                passos.append(
                    {
                        "type": "image",
                        "url": p.get("url"),
                        "base64": p.get("base64"),
                        "mimetype": p.get("mimetype") or "image/jpeg",
                        "filename": p.get("filename") or "imagem.jpg",
                        "index": i,
                    }
                )
        if passos:
            return passos

    passos = []
    if campaign.get("imagem_url"):
        passos.append(
            {
                "type": "image",
                "url": campaign["imagem_url"],
                "mimetype": campaign.get("imagem_mimetype") or "image/jpeg",
                "filename": "imagem.jpg",
                "index": 0,
            }
        )
    msg = campaign.get("message") or campaign.get("mensagem") or ""
    if msg:
        passos.append({"type": "text", "content": msg, "index": len(passos)})
    return passos


def passo_payload(passo: dict, chat_id: str, session: str, nome: str, telefone: str):
    """Retorna (endpoint, payload) do WAHA para o passo."""
    if passo["type"] == "text":
        return "sendText", {
            "session": session,
            "chatId": chat_id,
            "text": substituir_variaveis(passo["content"], nome, telefone),
        }
    # image
    if passo.get("url"):
        file = {"url": passo["url"], "mimetype": passo["mimetype"]}
    else:
        file = {"data": limpar_base64(passo["base64"]), "mimetype": passo["mimetype"]}
    file["filename"] = passo.get("filename") or "imagem.jpg"
    return "sendImage", {"session": session, "chatId": chat_id, "file": file}


# ─── Acesso a dados ───────────────────────────────────────────────────

def buscar_campanhas_running() -> list:
    status, data = supabase_rest(
        "GET", "bulk_campaigns", "?status=eq.running&select=*&order=created_at.asc"
    )
    if status != 200 or not isinstance(data, list):
        print(f"[Worker] Erro ao buscar campanhas: HTTP {status} {data}", file=sys.stderr)
        return []
    return data


def reclamar_campanha(campaign_id: str) -> bool:
    """Claim: só processa se ainda estiver 'running' (evita duplo worker)."""
    status, data = supabase_rest(
        "PATCH",
        "bulk_campaigns",
        f"?id=eq.{campaign_id}&status=eq.running&select=id",
        {"updated_at": datetime.now(timezone.utc).isoformat()},
    )
    return status == 200 and isinstance(data, list) and len(data) == 1


def atualizar_contadores(campaign_id: str, sent: int, failed: int, status=None, error_log=None):
    body = {"sent": sent, "failed": failed}
    if status:
        body["status"] = status
    if error_log is not None:
        body["error_log"] = error_log
    supabase_rest("PATCH", "bulk_campaigns", f"?id=eq.{campaign_id}", body)


def status_atual(campaign_id: str) -> str:
    status, data = supabase_rest("GET", "bulk_campaigns", f"?id=eq.{campaign_id}&select=status")
    if status == 200 and isinstance(data, list) and data:
        return data[0].get("status") or ""
    return ""


def registrar_log(campaign_id, phone, step_index, step_type, ok, detail=None):
    supabase_rest(
        "POST",
        "disparo_logs",
        "",
        {
            "campaign_id": campaign_id,
            "contact_phone": phone,
            "step_index": step_index,
            "step_type": step_type,
            "status": "ok" if ok else "err",
            "detail": detail,
        },
    )


_nome_cache: dict = {}


def resolver_nome(telefone: str) -> str:
    """{{nome}}: primeiro o cache, depois clientes.telefone (dígitos)."""
    d = normalizar_digits(telefone)
    if not d:
        return ""
    if d in _nome_cache:
        return _nome_cache[d]
    nome = ""
    try:
        # Tenta correspondência exata e depois 'contém' (telefone formatado)
        for q in (f"?telefone=eq.{urllib.parse.quote(telefone)}&select=nome_razao_social&limit=1",
                  f"?telefone=ilike.*{d[-8:]}*&select=nome_razao_social&limit=1"):
            status, data = supabase_rest("GET", "clientes", q)
            if status == 200 and isinstance(data, list) and data:
                nome = data[0].get("nome_razao_social") or data[0].get("nome") or ""
                if nome:
                    break
    except Exception:
        pass
    _nome_cache[d] = nome
    return nome


# ─── Processamento ────────────────────────────────────────────────────

def processar_campanha(campaign: dict) -> None:
    cid = campaign["id"]
    if not reclamar_campanha(cid):
        print(f"[Worker] Campanha {cid} não reclamada (outro worker?) — pulando")
        return

    numbers = campaign.get("numbers") or []
    session = campaign.get("instancia") or os.environ.get("WAHA_SESSION", "STK-1")
    intervalo = max(int(campaign.get("intervalo") or 5), 1)
    intervalo_passos = max(int(campaign.get("intervalo_passos") or 2), 1)
    delay_inicial = max(int(campaign.get("delay_inicial") or 0), 0)

    passos = montar_passos(campaign)
    if not passos:
        atualizar_contadores(cid, campaign.get("sent", 0), campaign.get("failed", 0),
                             status="failed", error_log="Campanha sem mensagem/imagem")
        return

    start = offset_retomada(campaign)
    sent = int(campaign.get("sent") or 0)
    failed = int(campaign.get("failed") or 0)

    print(f"[Worker] Campanha '{campaign.get('name')}' sessão={session} "
          f"contatos={len(numbers)} offset={start} passos={len(passos)}")

    if start == 0 and delay_inicial > 0:
        print(f"[Worker] delay_inicial: {delay_inicial}s")
        time.sleep(delay_inicial)

    for idx in range(start, len(numbers)):
        # Retomada/pausa: se a campanha saiu de 'running', para (UI pode retomar)
        st = status_atual(cid)
        if st != "running":
            print(f"[Worker] Campanha {cid} status='{st}' — parando")
            return

        contato = numbers[idx]
        if isinstance(contato, dict):
            telefone = contato.get("telefone") or contato.get("phone") or ""
            nome = contato.get("nome") or resolver_nome(telefone)
        else:
            telefone = str(contato)
            nome = resolver_nome(telefone)

        # Lista pode conter lixo (ex.: a própria instância 'STK-3'):
        # não é contato — não envia, conta como falha (retomada = sent+failed).
        if not eh_contato(telefone):
            failed += 1
            atualizar_contadores(cid, sent, failed)
            print(f"[Worker] {idx + 1}/{len(numbers)} entrada inválida "
                  f"'{telefone}' — não é telefone, pulando", file=sys.stderr)
            continue

        chat_id = formatar_chat_id(telefone)
        ok_all = True
        for passo in passos:
            endpoint, payload = passo_payload(passo, chat_id, session, nome, telefone)
            chat_anterior = chat_id
            # LID do GOWS: ao falhar, tenta a variante BR (9 extra) e passa
            # a usá-la nos próximos passos do mesmo contato.
            status, body, chat_id = enviar_passo(endpoint, payload, chat_id)
            ok = 200 <= status < 300
            if ok and chat_id != chat_anterior:
                print(f"[Worker] LID: {chat_anterior} sem resolucao -> "
                      f"enviado via {chat_id}", file=sys.stderr)
            detail = None
            if not ok:
                ok_all = False
                detail = str(body)[:500]
            registrar_log(cid, telefone, passo.get("index", 0), passo["type"], ok, detail)
            if not ok:
                print(f"[Worker] ERRO {endpoint} {chat_id}: {body}", file=sys.stderr)
                break
            if passo is not passos[-1]:
                time.sleep(intervalo_passos)

        if ok_all:
            sent += 1
        else:
            failed += 1
        atualizar_contadores(cid, sent, failed)
        print(f"[Worker] {idx + 1}/{len(numbers)} {telefone} -> {'ok' if ok_all else 'falhou'}")

        if idx < len(numbers) - 1:
            time.sleep(intervalo)

    final_status = "completed" if sent > 0 else "failed"
    atualizar_contadores(cid, sent, failed, status=final_status)
    print(f"[Worker] Campanha {cid} finalizada: {final_status} (sent={sent}, failed={failed})")


# ─── F1 — agendador único (C1 conta; C2 já sabe ALERTAR, com corte próprio) ───
# C1 (conversas sem resposta) só CONTA: o filtro fica na UI do atendimento.
# C2 (kanban parado) insere notificação, mas só com config.dry_run = false —
# o corte de segurança de cada rotina é a própria config, não o dry-run global.

_ULTIMO_LOG_ROTINA: dict = {}
_AVISO_TABELA_AUSENTE = {"visto": False}

# Última coluna do funil = oportunidade concluída (nunca alerta).
ETAPA_FINAL_KANBAN = "comissao_paga"
# O alerta vai para o DONO da oportunidade + estes cargos (mesmos gestores da UI).
CARGOS_GESTOR_KANBAN = ("admin", "diretor", "gerente_comercial")


def _contar(table: str, query: str):
    status, data = supabase_rest("GET", table, query)
    if status != 200 or not isinstance(data, list):
        print(f"[Agendador] falha ao contar {table}: HTTP {status} {data}", file=sys.stderr)
        return None
    return len(data)


def _janela(agora, horas):
    """Corte ISO em UTC. Sai com 'Z' e nunca com '+00:00': '+' na query string
    vira espaço no urllib e o PostgREST responde 400 (bug visto em 26/09)."""
    try:
        h = float(horas)
    except (TypeError, ValueError):
        h = 24.0
    if h <= 0:
        h = 24.0
    corte = (agora - timedelta(hours=h)).astimezone(timezone.utc)
    return h, corte.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def handler_conversas_sem_resposta(rotina, agora, ctx):
    """C1 — conversas em que o CLIENTE foi o último a falar há mais de X horas."""
    cfg = rotina.get("config") or {}
    h, corte = _janela(agora, cfg.get("janela_horas", 24))
    n = _contar(
        "atendimentos",
        "?select=id&status=in.(aberto,em_andamento)"
        f"&ultima_mensagem_remetente=eq.cliente&ultima_mensagem_data=lte.{corte}",
    )
    if n is None:
        return {"resumo": "falha ao contar atendimentos", "acoes": []}
    return {
        "resumo": f"{n} conversa(s) >{h:.0f}h sem resposta nossa",
        "acoes": [],
        "contagem": n,
    }


def handler_oportunidades_paradas(rotina, agora, ctx):
    """C2 — oportunidades sem mudança de etapa há mais de X horas (Fase 1).

    Corte de segurança (docs/HANDOFF.md): por padrão só MOSTRA o plano
    (config.dry_run = true). Para o alerta sair de verdade:

        UPDATE worker_rotinas
           SET config = config || '{"dry_run": false}'
         WHERE nome = 'preparacao_alerta_kanban';

    Anti-spam: a mesma oportunidade só gera outro alerta depois que MUDAR
    (updated_at maior que a data do último alerta emitido para ela).
    Regra espelhada em lib/oportunidades/parada.ts — mudou lá, muda aqui.
    """
    rest = ctx.get("rest") or supabase_rest
    cfg = rotina.get("config") if isinstance(rotina.get("config"), dict) else {}

    dry_run = agd._ativo(cfg.get("dry_run", True))        # padrão: ligado
    padrao = _horas_alerta(cfg.get("parada_horas"))
    por_etapa_cfg = cfg.get("por_etapa")
    por_etapa = {k: _horas_alerta(v, padrao)
                 for k, v in (por_etapa_cfg.items() if isinstance(por_etapa_cfg, dict) else [])}
    max_alertas = _inteiro_alerta(cfg.get("max_alertas"), 20)

    # Menor janela entre todas as etapas = superconjunto dos candidatas;
    # o recorte por etapa é feito depois, em Python.
    menor_janela = min([padrao] + list(por_etapa.values()))
    _, corte = _janela(agora, menor_janela)
    status, paradas = rest(
        "GET", "oportunidades",
        f"?select=id,titulo,cliente_nome,etapa,updated_at,vendedor_id"
        f"&etapa=neq.{ETAPA_FINAL_KANBAN}&updated_at=lte.{corte}"
        f"&order=updated_at.asc&limit=200",
    )
    if status != 200 or not isinstance(paradas, list):
        return {"resumo": f"falha ao buscar oportunidades paradas (HTTP {status})",
                "acoes": [], "contagem": 0, "alertas": 0, "cortadas": 0}

    # Recorte por etapa (limite configurável individualmente)
    candidatas = []
    for o in paradas:
        if not isinstance(o, dict):
            continue
        etapa = o.get("etapa") or ""
        if etapa == ETAPA_FINAL_KANBAN:
            continue
        atualizado = agd._parse_quando(o.get("updated_at"))
        if atualizado is None:
            continue
        horas = por_etapa.get(etapa, padrao)
        if (agora - atualizado) >= timedelta(hours=horas):
            candidatas.append((atualizado, horas, o))
    candidatas.sort(key=lambda t: t[0])          # mais antigas primeiro

    # Anti-spam: último alerta por oportunidade
    avisadas = _ultimos_alertas_kanban(rest)
    novas = [(d, h, o) for d, h, o in candidatas
             if avisadas.get(o.get("id")) is None or avisadas[o.get("id")] < d]

    total_novas = len(novas)
    lote = novas[:max_alertas]            # o que entra no lote = o que foi alertado
    cortadas = total_novas - len(lote)
    alertas = len(lote)

    base = f"{len(candidatas)} parada(s) >{padrao:.0f}h | {total_novas} alerta(s) novo(s)"
    acoes = [f"{o.get('cliente_nome') or o.get('titulo') or o.get('id')}"
             f" — {o.get('etapa')} ({h:.0f}h)" for _, h, o in lote]

    if dry_run:
        return {"resumo": f"{base} | dry_run: nada enviado",
                "acoes": acoes, "contagem": len(candidatas),
                "alertas": alertas, "cortadas": cortadas}

    if not lote:
        return {"resumo": f"{base} | nada a enviar", "acoes": acoes,
                "contagem": len(candidatas), "alertas": 0,
                "cortadas": cortadas}

    # Destinatário: o DONO da oportunidade + gestores. Avisar a equipe toda
    # transformaria o sino em ruído — cada vendedor cuida do próprio funil.
    status, perfis = rest("GET", "profiles", "?select=id,cargo")
    if status != 200 or not isinstance(perfis, list):
        return {"resumo": f"{base} | sem destinatário (falha ao ler profiles)",
                "acoes": acoes, "contagem": len(candidatas),
                "alertas": 0, "cortadas": cortadas}
    ids_validos = {p.get("id") for p in perfis
                   if isinstance(p, dict) and p.get("id")}
    gestores = {p.get("id") for p in perfis
                if isinstance(p, dict) and p.get("cargo") in CARGOS_GESTOR_KANBAN}

    linhas = []
    for _, h, o in lote:
        dests = set(gestores)
        if o.get("vendedor_id") in ids_validos:
            dests.add(o["vendedor_id"])
        for user_id in sorted(dests):
            linhas.append(
                {"user_id": user_id,
                 "tipo": "kanban_parado",
                 "titulo": f"{len(lote)} oportunidade(s) parada(s) no funil",
                 "mensagem": _mensagem_alerta_kanban(lote),
                 "lida": False,
                 "dados": {"oportunidade_id": o.get("id"),
                           "etapa": o.get("etapa"),
                           "cliente": o.get("cliente_nome") or o.get("titulo"),
                           "horas_parado": round(h, 1)}})

    if not linhas:
        return {"resumo": f"{base} | sem destinatário (dono ausente e sem gestor)",
                "acoes": acoes, "contagem": len(candidatas),
                "alertas": 0, "cortadas": cortadas}

    # Lote único com as MESMAS chaves (PostgREST: "All object keys must match")
    status, corpo = rest("POST", "notificacoes", "", linhas)
    if status >= 300:
        return {"resumo": f"{base} | falha ao gravar alerta (HTTP {status}) {corpo}",
                "acoes": acoes, "contagem": len(candidatas),
                "alertas": 0, "cortadas": cortadas}

    dests = {l["user_id"] for l in linhas}
    return {"resumo": f"{base} | alerta enviado para {len(dests)} perfil(is)",
            "acoes": acoes, "contagem": len(candidatas),
            "alertas": alertas, "cortadas": cortadas}


def _horas_alerta(valor, padrao=72.0):
    try:
        h = float(valor)
    except (TypeError, ValueError):
        return padrao
    return h if h > 0 else padrao


def _inteiro_alerta(valor, padrao):
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return padrao
    return n if n > 0 else padrao


def _ultimos_alertas_kanban(rest) -> dict:
    """{oportunidade_id: data do último alerta} — para não avisar 2x seguidas."""
    status, alertas = rest(
        "GET", "notificacoes",
        "?select=dados,created_at&tipo=eq.kanban_parado"
        "&order=created_at.desc&limit=500",
    )
    if status != 200 or not isinstance(alertas, list):
        return {}
    mapa: dict = {}
    for a in alertas:
        dados = a.get("dados") if isinstance(a, dict) else None
        oid = dados.get("oportunidade_id") if isinstance(dados, dict) else None
        quando = agd._parse_quando(a.get("created_at")) if isinstance(a, dict) else None
        if oid and quando is not None and (oid not in mapa or quando > mapa[oid]):
            mapa[oid] = quando
    return mapa


def _mensagem_alerta_kanban(lote) -> str:
    linhas = [f"• {o.get('cliente_nome') or o.get('titulo') or o.get('id')}"
              f" — {o.get('etapa') or 's/ etapa'} ({h:.0f}h parada)"
              for _, h, o in lote[:3]]
    resto = len(lote) - len(linhas)
    if resto > 0:
        linhas.append(f"... e mais {resto}")
    return "\n".join(linhas)


def handler_remarketing_diario(rotina, agora, ctx):
    """M1 — cria e roda a campanha diária de remarketing (Fase 2).

    Público (decisão D1, NÃO confundir com o C1): NÓS falamos por último e o
    cliente não respondeu em 24h. O C1 é a fila do CRM (cliente esperando).

    Corte de segurança: config.dry_run = True é o PADRÃO. Para valer é preciso
    editar a linha em worker_rotinas (dry_run: false) E religar o worker com
    AGENDADOR_DRY_RUN=0 — senão o agendador reexecuta a rotina a cada poll.

    Guardas (risco real: número banido por volume):
      1. cadência — 1 campanha a cada intervalo_horas_min (padrão 24h);
      2. template obrigatório;
      3. teto_diario (padrão 20 contatos);
      4. não remarcar o mesmo telefone em nao_rematar_dias (padrão 7);
      5. opt-out (remarketing_opt_out) — inegociável, sai sempre.
    """
    rest = ctx.get("rest") or supabase_rest
    cfg = rotina.get("config") or {}
    if not isinstance(cfg, dict):
        cfg = {}

    dry_run = agd._ativo(cfg.get("dry_run", True))
    janela = _horas_alerta(cfg.get("janela_horas"), 24.0)
    teto = _inteiro_alerta(cfg.get("teto_diario"), 20)
    cadencia_h = _horas_alerta(cfg.get("intervalo_horas_min"), 24.0)
    rematar_dias = _horas_alerta(cfg.get("nao_rematar_dias"), 7.0)
    template = str(cfg.get("template") or "").strip()
    instancia = str(cfg.get("instancia") or "") or os.environ.get("WAHA_SESSION") or "STK-3"
    intervalo = _inteiro_alerta(cfg.get("intervalo"), 60)
    intervalo_passos = _inteiro_alerta(cfg.get("intervalo_passos"), 10)
    try:
        delay_inicial = max(int(cfg.get("delay_inicial", 0)), 0)
    except (TypeError, ValueError):
        delay_inicial = 60

    # 1) público — a MESMA regra do preview do marketing (lib/marketing/remarketing)
    corte = _janela(agora, janela)[1]
    status, publico = rest(
        "GET", "atendimentos",
        "?select=telefone_cliente,nome_cliente,instancia"
        "&status=in.(aberto,em_andamento)"
        "&ultima_mensagem_remetente=neq.cliente"
        f"&ultima_mensagem_data=lte.{corte}"
        "&order=ultima_mensagem_data.asc"
        f"&limit={max(teto * 5, 500)}",
    )
    if status != 200 or not isinstance(publico, list):
        return {"resumo": f"falha ao buscar público (HTTP {status})",
                "acoes": [], "contagem": 0, "enviados": 0,
                "cortados": 0, "ignorados_opt_out": 0}
    publico = [a for a in publico if isinstance(a, dict)]

    # 2) opt-out — quem pediu para parar nunca mais recebe
    bloqueados: set = set()
    st_opt, optouts = rest("GET", "remarketing_opt_out", "?select=telefone")
    if st_opt == 200 and isinstance(optouts, list):
        for o in optouts:
            if isinstance(o, dict):
                tel = _telefone_canonico(o.get("telefone"))
                if tel:
                    bloqueados.add(tel)

    # 3) o que já foi remarketing (cadência + não remarcar)
    corte_rematar = (agora - timedelta(days=rematar_dias)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    st_cam, recentes = rest(
        "GET", "bulk_campaigns",
        "?select=id,created_at,numbers&tipo=eq.remarketing"
        f"&created_at=gte.{corte_rematar}&order=created_at.desc&limit=100",
    )
    if st_cam != 200 or not isinstance(recentes, list):
        # sem histórico não dá pra garantir cadência → não envia (seguro)
        return {"resumo": f"falha ao ler histórico de remarketing (HTTP {st_cam})",
                "acoes": [], "contagem": len(publico), "enviados": 0,
                "cortados": 0, "ignorados_opt_out": 0}
    recentes = [c for c in recentes if isinstance(c, dict)]

    rematados: set = set()
    for c in recentes:
        for n in (c.get("numbers") or []):
            tel = _telefone_canonico(n.get("telefone") if isinstance(n, dict) else n)
            if tel:
                rematados.add(tel)

    # 4) monta o lote (dedup por telefone, opt-out e já-rematados saem)
    lote: list = []
    vistos: set = set()
    ignorados_opt = 0
    for a in publico:
        tel = _telefone_canonico(a.get("telefone_cliente"))
        if not tel or tel in vistos:
            continue
        if tel in bloqueados:
            ignorados_opt += 1
            continue
        if tel in rematados:
            continue
        vistos.add(tel)
        lote.append({"nome": a.get("nome_cliente") or "",
                     "telefone": a.get("telefone_cliente")})

    total_elegiveis = len(lote)
    cortados = max(total_elegiveis - teto, 0)
    lote = lote[:teto]
    base = f"{len(publico)} no público | {len(lote)} elegíveis"
    acoes = [f"{c['nome'] or c['telefone']} ({c['telefone']})" for c in lote]

    # 5) guardas
    if any((agd._parse_quando(c.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc))
           >= agora - timedelta(hours=cadencia_h) for c in recentes):
        return {"resumo": f"{base} | cadência: já houve remarketing nas últimas "
                          f"{cadencia_h:.0f}h",
                "acoes": acoes, "contagem": len(publico), "enviados": 0,
                "cortados": cortados, "ignorados_opt_out": ignorados_opt}

    if not template:
        return {"resumo": f"{base} | template vazio — nada a enviar",
                "acoes": [], "contagem": len(publico), "enviados": 0,
                "cortados": cortados, "ignorados_opt_out": ignorados_opt}

    if not lote:
        return {"resumo": f"{base} | público vazio (após opt-out/recência/teto)",
                "acoes": [], "contagem": len(publico), "enviados": 0,
                "cortados": cortados, "ignorados_opt_out": ignorados_opt}

    if dry_run:
        return {"resumo": f"{base} | dry_run: nada enviado",
                "acoes": acoes, "contagem": len(publico), "enviados": 0,
                "cortados": cortados, "ignorados_opt_out": ignorados_opt}

    # 6) cria a campanha — o MESMO worker de sempre entrega (status running)
    campanha = {
        "name": f"Remarketing {agora.strftime('%d/%m/%Y %H:%M')}",
        "message": template,
        "numbers": lote,
        "status": "running",
        "sent": 0,
        "failed": 0,
        "tipo": "remarketing",
        "regra": {
            "origem": "publico_sem_resposta_24h",
            "janela_horas": janela,
            "teto_diario": teto,
            "nao_rematar_dias": rematar_dias,
            "intervalo_horas_min": cadencia_h,
            "dry_run": dry_run,
            "criado_por": "rotina:remarketing_diario",
        },
        "instancia": instancia,
        "intervalo": intervalo,
        "intervalo_passos": intervalo_passos,
        "delay_inicial": delay_inicial,
    }
    st_post, corpo = rest("POST", "bulk_campaigns", "", campanha)
    if st_post >= 300:
        return {"resumo": f"{base} | falha ao criar campanha (HTTP {st_post}) {corpo}",
                "acoes": acoes, "contagem": len(publico), "enviados": 0,
                "cortados": cortados, "ignorados_opt_out": ignorados_opt}

    return {"resumo": f"{base} | campanha criada e rodando",
            "acoes": acoes, "contagem": len(publico), "enviados": len(lote),
            "cortados": cortados, "ignorados_opt_out": ignorados_opt}


def _telefone_canonico(valor) -> str:
    """Só dígitos, sem o 55 inicial — '(62) 91111-1111' e '5562911111111' são o mesmo."""
    d = normalizar_digits(valor)
    if len(d) > 12 and d.startswith("55"):
        d = d[2:]
    return d


def registrar_rotinas() -> None:
    agd.registrar("preparacao_remarketing",
                  "Conta conversas >24h com o cliente aguardando resposta (C1)",
                  handler_conversas_sem_resposta)
    agd.registrar("preparacao_alerta_kanban",
                  "Conta oportunidades paradas >72h (C2)",
                  handler_oportunidades_paradas)
    agd.registrar("remarketing_diario",
                  "M1 — cria e roda a campanha diária de remarketing (corte próprio)",
                  handler_remarketing_diario)


def _buscar_rotinas():
    status, data = supabase_rest("GET", "worker_rotinas", "?select=*&order=nome.asc")
    if status == 200 and isinstance(data, list):
        return data
    if not _AVISO_TABELA_AUSENTE["visto"]:
        _AVISO_TABELA_AUSENTE["visto"] = True
        print("[Agendador] worker_rotinas indisponível "
              f"(HTTP {status}) — aplicar supabase/migrations/088 no SQL Editor.",
              file=sys.stderr)
    return None


def _salvar_rotina(rotina_id, patch):
    if not rotina_id:
        return
    supabase_rest("PATCH", "worker_rotinas", f"?id=eq.{rotina_id}", patch)


def loop_agendador(dry_run: bool = AGENDADOR_DRY_RUN) -> list:
    """Um ciclo do agendador. Nunca lança exceção. Retorna o relatório."""
    rotinas = _buscar_rotinas()
    if rotinas is None:
        return []
    agora = datetime.now(timezone.utc)
    relatorio = agd.executar_rotinas(
        rotinas, agora, handlers=agd.ROTINAS, dry_run=dry_run, salvar=_salvar_rotina
    )
    agora_ts = time.time()
    linhas = []
    for r in relatorio:
        if dry_run and r.get("status") == "dry_run":
            # dry-run não persiste, então a rotina continua "vencida": loga 1x/hora
            if agora_ts - _ULTIMO_LOG_ROTINA.get(r.get("nome") or "", 0) < 3600:
                continue
            _ULTIMO_LOG_ROTINA[r.get("nome") or ""] = agora_ts
        linha = f"[Agendador] {r.get('nome')} -> {r.get('status')}"
        if r.get("resumo"):
            linha += f" | {r['resumo']}"
        if r.get("erro"):
            linha += f" | ERRO: {r['erro']}"
        linhas.append(linha)
    if linhas:
        print("\n".join(linhas))
    return relatorio


def loop_fila() -> list:
    """Um ciclo da fila AXS (Fase 3 / C3). Nunca lança exceção."""
    relatorio = fila_axs.processar_fila()
    linhas = []
    for r in relatorio:
        if r.get("status") == "ignorado":
            continue
        linha = f"[Fila AXS] {r.get('id')} -> {r.get('status')}"
        if r.get("erro"):
            linha += f" | {r.get('erro')}"
        linhas.append(linha)
    if linhas:
        print("\n".join(linhas))
    return relatorio


def main() -> None:
    faltando = [n for n, v in (("SUPABASE_URL", SUPABASE_URL),
                               ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
                               ("WAHA_API_URL", WAHA_URL),
                               ("WAHA_API_KEY", WAHA_KEY)) if not v]
    if faltando:
        print(f"[Worker] Env vars obrigatórias faltando: {', '.join(faltando)}", file=sys.stderr)
        sys.exit(2)

    registrar_rotinas()
    print(f"[Worker] Iniciado. Supabase={SUPABASE_URL} WAHA={WAHA_URL} poll={POLL_SECONDS}s "
          f"| agendador: poll={AGENDADOR_POLL_SECONDS}s dry_run={AGENDADOR_DRY_RUN} "
          f"| fila AXS: poll={fila_axs.INTERVALO_CICLO_SEG}s max_tentativas={fila_axs.MAX_TENTATIVAS_PADRAO}")

    ultimo_agendador = 0.0
    ultimo_fila_axs = 0.0
    while True:
        try:
            for campaign in buscar_campanhas_running():
                processar_campanha(campaign)
        except Exception as e:  # nunca morrer por 1 erro
            print(f"[Worker] Erro no loop: {e}", file=sys.stderr)
        try:
            if time.time() - ultimo_agendador >= AGENDADOR_POLL_SECONDS:
                ultimo_agendador = time.time()
                loop_agendador()
        except Exception as e:
            print(f"[Worker] Erro no agendador: {e}", file=sys.stderr)
        # Fase 3 / C3 — fila "cadastrar no CRM -> criar na AXS"
        # kill switch: FILA_POLL_SECONDS=0 desliga o loop sem deploy
        try:
            if fila_axs.INTERVALO_CICLO_SEG > 0 and \
                    time.time() - ultimo_fila_axs >= fila_axs.INTERVALO_CICLO_SEG:
                ultimo_fila_axs = time.time()
                loop_fila()
        except Exception as e:
            print(f"[Worker] Erro na fila AXS: {e}", file=sys.stderr)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
