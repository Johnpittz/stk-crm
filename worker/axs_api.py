#!/usr/bin/env python3
"""
axs_api.py — cria proposta na AXS pela API de verdade (Fase 3 / C3, decisão D4).

Por que API e não Playwright: o portal (portal.axsenergia.com.br) é um SPA que
fala com `https://iris.axsenergia.com.br/` e o axios de lá é criado SÓ com
`Content-Type: application/json` (interceptor `e => e` — não manda Authorization).
Ou seja: a criação é HTTP puro, sem navegador.

Fonte dos endpoints/corpos: bundle público `/onboarding/assets/index-B9fgXBnn.js`
(lido em 27/09/2026). Leituras ao vivo confirmadas:
  GET  /csp/estadoconce/consultar       -> {"estados":[{"UF":"GO","nome":"Goiás"},...]}
  GET  /csp/estadoconce/consultar/GO    -> {"concessionarias":[{"nome":"EQUATORIAL GO"}]}
  POST /csp/usuario/criar/              -> {"idCard"} (200/201)

Sequência (idempotente por `idCard`):
  1 criar → 2 dadosContratante/{pf|pj} → 3 enderecoConsumo
  → 4 dadosFatura → 5 historicoConsumo → 6 aceiteProposta/

Regra de falha: se o passo 1 falha NADA existe (devolve >=400 sem idCard → a fila
repete com backoff). Se um passo posterior falha, o card JÁ existe: devolve 200 com
`parcial=True` + `idCard`, para a fila marcar `criada` e deixar o pendente visível —
repetir o passo 1 criaria proposta DUPLICADA na AXS.

Somente stdlib (sem pip), como o resto do worker.
"""

import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("AXS_API_URL", "https://iris.axsenergia.com.br").rstrip("/")

# UF -> nome por extenso (o portal manda o NOME, não a sigla)
NOMES_UF = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
    "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul", "RO": "Rondônia",
    "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe",
    "TO": "Tocantins",
}

# tipo_imovel do form do CRM -> valor que o campo "tipoResi" da AXS aceita
TIPO_RESI = {
    "casa": "Casa/apto",
    "comercio": "Comércio",
    "industria": "Indústria",
    "rural": "Rural",
}

MESES = ("jan", "fev", "mar", "abr", "mai", "jun",
         "jul", "ago", "set", "out", "nov", "dez")


# ─── mapeamentos puros ───────────────────────────────────────────────

def nome_estado(uf: str) -> str:
    return NOMES_UF.get((uf or "").strip().upper(), (uf or "").strip())


def tipo_resi(tipo_imovel: str) -> str:
    return TIPO_RESI.get((tipo_imovel or "").strip().lower(), tipo_imovel or "")


def tipo_pessoa(valor) -> str:
    return (valor or "PF").strip().upper()


def normalizar_telefone(valor: str) -> str:
    """'62999999999' -> '(62) 99999-9999'; já formatado passa direto."""
    d = "".join(c for c in (valor or "") if c.isdigit())
    if len(d) in (12, 13) and d.startswith("55"):
        d = d[2:]
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return (valor or "").strip()


def _int(valor) -> int:
    try:
        return int(float(str(valor).replace(",", ".")))
    except (TypeError, ValueError):
        return 0


def _mes(dados: dict, chave: str, prefixo: str) -> dict:
    """consumo_meses/geracao_meses do CRM -> consumoJan.. / gerPropriaJan.."""
    origem = dados.get(chave) or {}
    return {
        f"{prefixo}{m.capitalize()}": _int(origem.get(m))
        for m in MESES
    }


# ─── payloads ────────────────────────────────────────────────────────

def montar_criar(dados: dict, representante: str) -> dict:
    """POST /csp/usuario/criar/ — primeiro passo; devolve {idCard}."""
    telefone = normalizar_telefone(dados.get("telefone") or "")
    whatsapp = normalizar_telefone(dados.get("whatsapp") or "")
    return {
        "estado": nome_estado(dados.get("estado") or ""),
        "concessionaria": (dados.get("concessionaria") or "").strip(),
        "tipoResi": tipo_resi(dados.get("tipo_imovel") or ""),
        "termoCondicao": True,
        "nomeRazao": (dados.get("nome") or "").strip(),
        "telefone": telefone,
        "telefoneLigacao": whatsapp or telefone,
        "email": (dados.get("email") or "").strip(),
        "tipoPessoa": tipo_pessoa(dados.get("tipo_pessoa")),
        "aceiteMarketing": 0,
        "representante": representante,
        "indicacao": "",
    }


def sequencia_etapas(id_card: str, dados: dict) -> list:
    """Passos 2..6: (nome, url, corpo). Nome curto = aparece no `erro` da fila."""
    documento = "".join(c for c in (dados.get("cpf_cnpj") or "") if c.isdigit())
    pj = tipo_pessoa(dados.get("tipo_pessoa")) == "PJ"

    if pj:
        contratante = {
            "idCard": id_card,
            "razaoSocial": (dados.get("nome") or "").strip(),
            "cnpj": documento,
            "email": (dados.get("email") or "").strip(),
            "telefoneContato": normalizar_telefone(dados.get("telefone") or ""),
            "ucIndicador": "", "nomeIndicador": "",
            "cpfCpnjIndicador": "", "acaoBarramento": "",
        }
    else:
        contratante = {
            "idCard": id_card,
            "nomeCompleto": (dados.get("nome") or "").strip(),
            "cpf": documento,
            "dataNascimento": (dados.get("data_nascimento") or "").strip(),
            "email": (dados.get("email") or "").strip(),
            "ucIndicador": "", "nomeIndicador": "",
            "cpfCpnjIndicador": "", "acaoBarramento": "",
        }

    endereco = {
        "idCard": id_card,
        "cep": "".join(c for c in (dados.get("cep") or "") if c.isdigit()),
        "logradouro": (dados.get("logradouro") or "").strip(),
        "numero": (dados.get("numero") or "").strip(),
        "complemento": (dados.get("complemento") or "").strip(),
        "bairro": (dados.get("bairro") or "").strip(),
        "cidade": (dados.get("cidade") or "").strip(),
        "estado": (dados.get("estado") or "").strip(),
    }

    fatura = {
        "idCard": id_card,
        "classe": (dados.get("classe") or "").strip(),
        "subClasse": (dados.get("subgrupo") or "").strip(),
        "diaVencimento": (dados.get("vencimento_dia") or "").strip(),
        "unidadeConsumidora": (dados.get("uc_instalacao") or "").strip(),
        "fatura": "",
    }

    historico = {
        "idCard": id_card,
        **_mes(dados, "consumo_meses", "consumo"),
        "fatura": {
            "geracaoPropria": bool(dados.get("geracao_propria")),
            **_mes(dados, "geracao_meses", "gerPropria"),
        },
    }

    aceite = {"aceiteProposta": 1, "idCard": id_card}

    return [
        ("contratante", f"{BASE}/csp/usuario/alterar/v2/dadosContratante/"
                        f"{'pj' if pj else 'pf'}", contratante),
        ("endereco", f"{BASE}/csp/usuario/alterar/v2/enderecoConsumo", endereco),
        ("fatura", f"{BASE}/csp/usuario/alterar/v2/dadosFatura", fatura),
        ("historico", f"{BASE}/csp/usuario/alterar/v2/historicoConsumo", historico),
        ("aceite", f"{BASE}/csp/usuario/alterar/aceiteProposta/", aceite),
    ]


# ─── HTTP ────────────────────────────────────────────────────────────

def http_padrao(metodo: str, url: str, corpo=None):
    """(status, corpo). Nunca lança exceção."""
    data = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(
        url, data=data, method=metodo,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            bruto = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(bruto) if bruto.strip() else {})
    except urllib.error.HTTPError as e:
        bruto = ""
        try:
            bruto = e.read().decode("utf-8", "replace")
        except Exception:
            pass
        try:
            return e.code, json.loads(bruto) if bruto.strip() else {"error": str(e)}
        except ValueError:
            return e.code, {"error": bruto[:300] or str(e)}
    except Exception as e:  # rede, timeout, DNS — nada disso pode derrubar o lote
        return 0, {"error": f"{type(e).__name__}: {e}"}


def _msg(corpo, status) -> str:
    if isinstance(corpo, dict):
        for chave in ("retorno", "mensagem", "message", "error", "erro"):
            if corpo.get(chave):
                return str(corpo[chave])
    return str(corpo)[:300] or f"HTTP {status}"


def _ok(status) -> bool:
    return isinstance(status, int) and 200 <= status < 300


def criar_proposta(dados: dict, representante: str, http=None):
    """
    Executa a sequência inteira. Retorna (status, corpo):
      sucesso     -> (200, {"idCard": ..., "etapas_ok": 5})
      parcial     -> (200, {"idCard": ..., "parcial": True, "etapa": "...", "erro": ...})
      falha       -> (>=400, {"erro": ...})  — sem idCard, a fila pode repetir
    """
    http = http or http_padrao
    try:
        status, corpo = http("POST", f"{BASE}/csp/usuario/criar/",
                             montar_criar(dados, representante))
        if not _ok(status):
            return (status or 500), {"erro": f"criar: {_msg(corpo, status)}"}
        if not isinstance(corpo, dict) or not corpo.get("idCard"):
            return 502, {"erro": f"criar: resposta sem idCard -> {corpo}"}
        id_card = corpo["idCard"]
    except Exception as e:
        return 500, {"erro": f"criar: {type(e).__name__}: {e}"}

    for nome, url, corpo_etapa in sequencia_etapas(id_card, dados):
        try:
            status, resp = http("POST", url, corpo_etapa)
        except Exception as e:
            status, resp = 500, {"error": f"{type(e).__name__}: {e}"}
        if not _ok(status):
            # o card já existe: NÃO repetir o passo 1 (evita proposta duplicada)
            return 200, {
                "idCard": id_card,
                "parcial": True,
                "etapa": nome,
                "erro": f"{nome}: {_msg(resp, status)}",
            }

    return 200, {"idCard": id_card, "etapas_ok": len(sequencia_etapas(id_card, dados))}


def criar_da_fila(item: dict, representante: str, http=None):
    """Adaptador para o processador da fila: linha -> (status, corpo)."""
    return criar_proposta(item.get("payload") or {}, representante, http)
