#!/usr/bin/env python3
"""AXS — criação de proposta pelo fluxo ARP (o de verdade).

Fonte da verdade: captura ao vivo do assistente ARP em 27/09/2026 e o
payload de 1655 bytes que a AXS aceita — ver docs/axs-fluxo-oficial.md.

Endpoints:
  POST /csp/representante/login/       -> {retorno:"OK", acessToken, informacao}
  POST /csp/representante/criar/card/  -> 201 {idCard, mensalidade_axs, ...}

Armadilhas (quebram tudo se errar uma):
  * fatura.classe      = tipo de conexão (Monofásico/Bifásico/Trifásico)
  * fatura.subClasse   = grupo (Residencial/Comercial/Industrial/Rural/Outros)
  * observacoes        = objeto {"temperatura", "observacao"}, nunca texto
  * endereco.estado    = por extenso ("Goiás"), CEP com traço, CPF mascarado
  * representante      = só os campos da sessão (sem gestor3/equipe/regional)

Só stdlib (regra do worker). HTTP injetável para os testes.
"""
import json
import os
import re
import urllib.error
import urllib.request

BASE = os.environ.get("AXS_API_URL", "https://iris.axsenergia.com.br").rstrip("/")
TENANT = "ARP"
ROTA_LOGIN = "/csp/representante/login/"
ROTA_CRIAR = "/csp/representante/criar/card/"

MESES = ("jan", "fev", "mar", "abr", "mai", "jun",
         "jul", "ago", "set", "out", "nov", "dez")
SIGLAS_MES = {
    "jan": "Jan", "fev": "Fev", "mar": "Mar", "abr": "Abr", "mai": "Mai",
    "jun": "Jun", "jul": "Jul", "ago": "Ago", "set": "Set", "out": "Out",
    "nov": "Nov", "dez": "Dez",
}

NOMES_UF = {
    "GO": "Goiás", "MT": "Mato Grosso", "MG": "Minas Gerais",
    "PR": "Paraná", "SP": "São Paulo",
}

TIPO_PROPOSTA = {
    "casa": "Casa/apto", "comercio": "Comércio", "industria": "Indústria",
    "rural": "Rural", "outros": "Outros",
}

GRUPOS = ("Residencial", "Comercial", "Industrial", "Rural", "Outros")
GRUPO_DO_IMOVEL = {
    "casa": "Residencial", "comercio": "Comercial", "industria": "Industrial",
    "rural": "Rural", "outros": "Outros",
}

# Chave do bloco "representante" do payload, lida direto do `informacao`
# que o login devolve (chaves do bundle ARP, com acento preservado).
CHAVES_REPRESENTANTE = (
    ("nome", "nome"),
    ("email", "e_mail"),
    ("CPF", "cpf"),
    ("razao", "raz_o_social"),
    ("CNPJ", "cnpj"),
    ("codigoLink", "c_digo_do_link_verificar_com_a_bplus"),
    ("canal", "canal"),
    ("tipo", "tipo"),
    ("grupo", "grupo"),
    ("gestor1", "gerente_respons_vel"),
    ("gestor2", "executivo_supervisor_respons_vel"),
    ("origem", "origem"),
    ("codigoPlano", "plano_que_est_vendendo"),
)


# ───────────────────────────── mapeamentos puros ─────────────────────────────

def nome_estado(uf) -> str:
    """'GO' -> 'Goiás' (o ARP recebe o label, não a sigla)."""
    return NOMES_UF.get(str(uf or "").strip().upper(), str(uf or ""))


def tipo_resi(tipo) -> str:
    """Tipo de imóvel do CRM -> tipoProposta do ARP."""
    return TIPO_PROPOSTA.get(str(tipo or "").strip().lower(), "Casa/apto")


def fase_da_classe(dados: dict) -> str:
    """subgrupo do CRM (B1/B2/B3/A...) -> tipo de conexão.

    B1 monofásico, B2 bifásico, B3 trifásico; alta tensão (A*, AS, BS)
    também trifásico. Vazio/desconhecido cai em Monofásico (padrão da UI).
    """
    sub = str(dados.get("subgrupo") or "").strip().upper()
    if sub.startswith("B1"):
        return "Monofásico"
    if sub.startswith("B2"):
        return "Bifásico"
    if sub.startswith(("B3", "A", "BS")):
        return "Trifásico"
    return "Monofásico"


def grupo_tarifario(dados: dict) -> str:
    """classe do CRM (Residencial/Comercial/...) -> subClasse do ARP."""
    classe = str(dados.get("classe") or "").strip()
    if classe in GRUPOS:
        return classe
    return GRUPO_DO_IMOVEL.get(str(dados.get("tipo_imovel") or "").strip().lower(),
                               "Residencial")


def normalizar_telefone(valor) -> str:
    d = re.sub(r"\D", "", str(valor or ""))
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    return str(valor or "")


def mascara_cpf(valor) -> str:
    d = re.sub(r"\D", "", str(valor or ""))
    if len(d) != 11:
        return str(valor or "")
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


def mascara_cnpj(valor) -> str:
    d = re.sub(r"\D", "", str(valor or ""))
    if len(d) != 14:
        return str(valor or "")
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


def cep_mascarado(valor) -> str:
    d = re.sub(r"\D", "", str(valor or ""))
    if len(d) != 8:
        return str(valor or "")
    return f"{d[:5]}-{d[5:]}"


def data_iso(valor) -> str:
    """'01/02/1985' -> '1985-02-01' (dataNascimento vai ISO)."""
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", str(valor or "").strip())
    if not m:
        return str(valor or "")
    dia, mes, ano = m.groups()
    return f"{ano}-{mes}-{dia}"


def _inteiro(valor, padrao=0) -> int:
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return padrao


# ─────────────────────────────── login / sessão ──────────────────────────────

def montar_login(email, senha) -> dict:
    return {"email": str(email or ""), "senha": str(senha or "")}


def extrair_sessao(corpo: dict) -> dict:
    """200 {retorno, acessToken, informacao} -> sessão usada no payload.

    Levanta ValueError quando não dá pra seguir (senha errada, sessão ativa).
    """
    if not isinstance(corpo, dict):
        raise ValueError("login: resposta sem corpo")
    if corpo.get("chaveVerificaSessao"):
        raise ValueError("sessão ativa em outro dispositivo")
    token = corpo.get("acessToken") or corpo.get("accessToken")
    info = corpo.get("informacao") or {}
    if not token:
        raise ValueError(_msg(corpo, 200))
    representante = {}
    for destino, origem in CHAVES_REPRESENTANTE:
        valor = info.get(origem)
        if valor is None:
            valor = ""
        representante[destino] = valor
    return {"token": token, "representante": representante}


def logar(email, senha, http=None):
    """(status, sessao) ou (status, {erro}) quando o login falha."""
    http = http or http_padrao
    try:
        status, corpo = http("POST", BASE + ROTA_LOGIN, montar_login(email, senha),
                             _cabecalhos())
    except Exception as e:
        return 0, {"erro": f"login: {type(e).__name__}: {e}"}
    if not _ok(status):
        return status or 500, {"erro": f"login: {_msg(corpo, status)}"}
    try:
        return status, extrair_sessao(corpo)
    except ValueError as e:
        return 401, {"erro": f"login: {e}"}


_SESSAO = {"chave": "", "sessao": None}


def limpar_sessao() -> None:
    """Para os testes e para quando o token expira."""
    _SESSAO["chave"] = ""
    _SESSAO["sessao"] = None


def _sessao_de(credenciais: dict, http):
    """Login com cache por e-mail (evita logar a cada item da fila)."""
    email = str((credenciais or {}).get("email") or "").strip()
    senha = str((credenciais or {}).get("senha") or "")
    if not email or not senha:
        return 400, {"erro": "AXS_ARP_EMAIL/AXS_ARP_SENHA não configurados "
                             "no env do worker"}
    if _SESSAO["chave"] == email and _SESSAO["sessao"]:
        return 200, _SESSAO["sessao"]
    status, sessao = logar(email, senha, http)
    if isinstance(sessao, dict) and sessao.get("token"):
        _SESSAO["chave"] = email
        _SESSAO["sessao"] = sessao
    return status, sessao


# ───────────────────────────── payload da criação ────────────────────────────

def montar_proposta(dados: dict, sessao: dict) -> dict:
    """Payload exato do ARP (capturado ao vivo). Ver docs/axs-fluxo-oficial.md."""
    dados = dados or {}
    meses = dados.get("consumo_meses") or {}
    geracao = dados.get("geracao_meses") or {}

    consumo = {f"consumo{SIGLAS_MES[m]}": str(meses.get(m) or "0") for m in MESES}
    ger_propria = {f"gerPropria{SIGLAS_MES[m]}": str(geracao.get(m) or "0")
                   for m in MESES}

    fatura = {
        "faturas": [],
        "concessionaria": str(dados.get("concessionaria") or ""),
        "numeroInstalacao": str(dados.get("uc_instalacao") or ""),
        "dataVencimentoFatura": _inteiro(dados.get("vencimento_dia")),
        "classe": fase_da_classe(dados),
        "subClasse": grupo_tarifario(dados),
        **consumo,
        "geracaoPropria": bool(dados.get("geracao_propria")),
        **ger_propria,
    }

    telefone = normalizar_telefone(dados.get("whatsapp") or dados.get("telefone"))
    payload = {
        "tipoProposta": tipo_resi(dados.get("tipo_imovel")),
        "tipoPessoa": "PF" if str(dados.get("tipo_pessoa") or "pf").lower() == "pf"
                      else "PJ",
        "telefoneLigacao": telefone,
        "observacoes": {
            "temperatura": str(dados.get("temperatura") or ""),
            "observacao": str(dados.get("observacoes") or ""),
        },
        "representante": dict(sessao.get("representante") or {}),
        "dadosBancario": {"formaPagamento": "Pix"},
        "endereco": {
            "CEP": cep_mascarado(dados.get("cep")),
            "estado": nome_estado(dados.get("estado")),
            "cidade": str(dados.get("cidade") or ""),
            "bairro": str(dados.get("bairro") or ""),
            "logradouro": str(dados.get("logradouro") or ""),
            "numero": str(dados.get("numero") or ""),
            "complemento": str(dados.get("complemento") or ""),
        },
        "fatura": fatura,
        "usina": {
            "CRI": str(dados.get("consorcio") or ""),
            "usina": str(dados.get("usina") or ""),
        },
    }

    if payload["tipoPessoa"] == "PF":
        payload["pessoaFisica"] = {
            "nomeCompleto": str(dados.get("nome") or ""),
            "CPF": mascara_cpf(dados.get("cpf_cnpj")),
            "email": str(dados.get("email") or ""),
            "telefone": telefone,
            "dataNascimento": data_iso(dados.get("data_nascimento")),
        }
    else:
        payload["pessoaJuridica"] = {
            "razaoSocial": str(dados.get("nome") or ""),
            "CNPJ": mascara_cnpj(dados.get("cpf_cnpj")),
            "emailEmpresa": str(dados.get("email") or ""),
            "telefoneEmpresa": telefone,
            "responsavel": {
                "nomeCompleto": str(dados.get("responsavel_nome") or ""),
                "CPF": mascara_cpf(dados.get("responsavel_cpf")),
                "email": str(dados.get("responsavel_email") or ""),
                "telefone": normalizar_telefone(dados.get("responsavel_telefone")),
                "dataNascimento": data_iso(dados.get("responsavel_nascimento")),
            },
        }
    return payload


# ─────────────────────────────────── HTTP ────────────────────────────────────

def _cabecalhos(token: str = "") -> dict:
    cab = {"Content-Type": "application/json", "tennant": TENANT}
    if token:
        cab["Authorization"] = f"Bearer {token}"
    return cab


def http_padrao(metodo: str, url: str, corpo=None, headers=None, timeout=30):
    """POST/GET com JSON. Nunca lança: devolve (status, dict) sempre."""
    dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    for chave, valor in (headers or {}).items():
        req.add_header(chave, valor)
    if dados is not None and not any(k.lower() == "accept" for k in (headers or {})):
        req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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
    except Exception as e:  # rede, timeout, DNS — nada disso derruba o lote
        return 0, {"error": f"{type(e).__name__}: {e}"}


def _msg(corpo, status) -> str:
    if isinstance(corpo, dict):
        for chave in ("retorno", "mensagem", "message", "error", "erro", "summary"):
            if corpo.get(chave):
                return str(corpo[chave])
        erros = corpo.get("errors")
        if isinstance(erros, list) and erros and isinstance(erros[0], dict):
            return str(erros[0].get("error") or "")[:300] or f"HTTP {status}"
    return str(corpo)[:300] or f"HTTP {status}"


def _ok(status) -> bool:
    return isinstance(status, int) and 200 <= status < 300


# ──────────────────────────────── criação ────────────────────────────────────

def criar_proposta(dados: dict, sessao: dict, http=None):
    """Cria a proposta pelo ARP. Retorna (status, corpo):
      sucesso -> (201, {"idCard": ..., "mensalidade_axs": ...})
      falha   -> (>=400, {"erro": ...})  — sem idCard, a fila pode repetir
    """
    http = http or http_padrao
    if not isinstance(sessao, dict) or not sessao.get("token"):
        return 401, {"erro": "sessão sem token — fazer login antes de criar"}
    try:
        status, corpo = http("POST", BASE + ROTA_CRIAR,
                             montar_proposta(dados, sessao),
                             _cabecalhos(sessao["token"]))
    except Exception as e:
        return 500, {"erro": f"criar: {type(e).__name__}: {e}"}
    if not _ok(status):
        return status or 500, {"erro": f"criar: {_msg(corpo, status)}"}
    id_card = corpo.get("idCard") or corpo.get("id") if isinstance(corpo, dict) else None
    if not id_card:
        return 502, {"erro": f"criar: resposta sem idCard -> {str(corpo)[:200]}"}
    return status, {
        "idCard": id_card,
        "mensalidade_axs": corpo.get("mensalidade_axs", ""),
        "status": corpo.get("status_arp", ""),
    }


def criar_da_fila(item: dict, credenciais: dict, http=None):
    """Adaptador do processador da fila: linha -> (status, corpo).

    Faz login (com cache), cria, e se o token estiver expirado refaz o login
    uma única vez antes de devolver o erro.
    """
    http = http or http_padrao
    status, sessao = _sessao_de(credenciais, http)
    if not isinstance(sessao, dict) or not sessao.get("token"):
        return status or 500, {"erro": sessao.get("erro", "login falhou")
                               if isinstance(sessao, dict) else str(sessao)}
    payload = item.get("payload") if isinstance(item, dict) else None
    payload = payload or (item if isinstance(item, dict) else {})
    status, corpo = criar_proposta(payload, sessao, http)
    if status == 401:  # token expirou no meio do lote
        limpar_sessao()
        status, sessao = _sessao_de(credenciais, http)
        if isinstance(sessao, dict) and sessao.get("token"):
            status, corpo = criar_proposta(payload, sessao, http)
    return status, corpo
