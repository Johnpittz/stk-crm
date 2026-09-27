#!/usr/bin/env python3
"""Fase 3 / C3 — sequência de criação de proposta na AXS (API real, sem Playwright).

Fonte da verdade: JS do portal (portal.axsenergia.com.br/onboarding), bundle
/onboarding/assets/index-B9fgXBnn.js — endpoints e corpos extraídos de lá em 27/09/2026.
Zero rede nos testes: o HTTP é injetado.

Endpoints confirmados (leitura ao vivo em 27/09):
  GET  /csp/estadoconce/consultar            -> {estados:[{UF,nome}]}
  GET  /csp/estadoconce/consultar/{UF}       -> {concessionarias:[{nome}]}
  POST /csp/usuario/criar/                   -> {idCard}   (200/201)
  POST /csp/usuario/alterar/v2/dadosContratante/{pf|pj}
  POST /csp/usuario/alterar/v2/enderecoConsumo
  POST /csp/usuario/alterar/v2/dadosFatura
  POST /csp/usuario/alterar/v2/historicoConsumo
  POST /csp/usuario/alterar/aceiteProposta/
"""
import unittest

import axs_api

REPRESENTANTE = "6OQ36BHO60Q2SE1J64MJ6D0"

def dados_base(**kw):
    d = {
        "tipo_imovel": "casa",
        "tipo_pessoa": "pf",
        "cpf_cnpj": "12345678901",
        "nome": "João da Silva",
        "data_nascimento": "01/02/1990",
        "email": "joao@email.com",
        "telefone": "(62) 99999-9999",
        "whatsapp": "",
        "cep": "74000000",
        "logradouro": "Rua A",
        "numero": "10",
        "complemento": "quadra 2",
        "bairro": "Centro",
        "cidade": "Goiânia",
        "estado": "GO",
        "classe": "Residencial",
        "subgrupo": "B1",
        "uc_instalacao": "123456",
        "vencimento_dia": "10",
        "concessionaria": "EQUATORIAL GO",
        "consumo_meses": {m: "300" for m in
                          ("jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez")},
        "geracao_propria": False,
        "geracao_meses": {m: "" for m in
                          ("jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez")},
        "observacoes": "",
    }
    d.update(kw)
    return d


class HttpFalso:
    """Câmbio: grava tudo e devolve o que o teste mandar."""

    def __init__(self, respostas=None, padrao=(200, {})):
        self.chamadas = []
        self.respostas = respostas or {}
        self.padrao = padrao

    def __call__(self, metodo, url, corpo=None):
        self.chamadas.append({"metodo": metodo, "url": url, "corpo": corpo})
        for chave, resp in self.respostas.items():
            if chave in url:
                return resp if isinstance(resp, tuple) else (200, resp)
        return self.padrao


class TestMapeamentos(unittest.TestCase):
    def test_estado_vai_por_extenso(self):
        self.assertEqual(axs_api.nome_estado("GO"), "Goiás")

    def test_estado_desconhecido_nao_quebra(self):
        self.assertEqual(axs_api.nome_estado("XX"), "XX")

    def test_tipo_imovel(self):
        self.assertEqual(axs_api.tipo_resi("casa"), "Casa/apto")
        self.assertEqual(axs_api.tipo_resi("comercio"), "Comércio")
        self.assertEqual(axs_api.tipo_resi("industria"), "Indústria")
        self.assertEqual(axs_api.tipo_resi("rural"), "Rural")

    def test_telefone_normalizado(self):
        self.assertEqual(axs_api.normalizar_telefone("62999999999"), "(62) 99999-9999")
        self.assertEqual(axs_api.normalizar_telefone("(62) 9999-9999"), "(62) 9999-9999")
        self.assertEqual(axs_api.normalizar_telefone(""), "")

    def test_tipopessoa_maiusculo(self):
        self.assertEqual(axs_api.tipo_pessoa("pj"), "PJ")


class TestMontarCriar(unittest.TestCase):
    def test_payload_do_criar(self):
        p = axs_api.montar_criar(dados_base(), REPRESENTANTE)
        self.assertEqual(p["representante"], REPRESENTANTE)
        self.assertEqual(p["estado"], "Goiás")
        self.assertEqual(p["concessionaria"], "EQUATORIAL GO")
        self.assertEqual(p["tipoResi"], "Casa/apto")
        self.assertEqual(p["tipoPessoa"], "PF")
        self.assertEqual(p["termoCondicao"], True)
        self.assertEqual(p["aceiteMarketing"], 0)
        self.assertEqual(p["indicacao"], "")
        self.assertEqual(p["nomeRazao"], "João da Silva")
        self.assertEqual(p["telefone"], "(62) 99999-9999")
        # nunca manda payload do CRM cru
        self.assertNotIn("consumo_meses", p)
        self.assertNotIn("uc_instalacao", p)


class TestSequencia(unittest.TestCase):
    def test_ordem_e_urls(self):
        etapas = axs_api.sequencia_etapas("card-1", dados_base())
        urls = [e[1] for e in etapas]
        nomes = [e[0] for e in etapas]
        self.assertEqual(nomes, ["contratante", "endereco", "fatura", "historico", "aceite"])
        self.assertTrue(urls[0].endswith("/csp/usuario/alterar/v2/dadosContratante/pf"))
        self.assertTrue(urls[1].endswith("/csp/usuario/alterar/v2/enderecoConsumo"))
        self.assertTrue(urls[2].endswith("/csp/usuario/alterar/v2/dadosFatura"))
        self.assertTrue(urls[3].endswith("/csp/usuario/alterar/v2/historicoConsumo"))
        self.assertTrue(urls[4].endswith("/csp/usuario/alterar/aceiteProposta/"))

    def test_contratante_pj_usa_razao_social(self):
        etapas = axs_api.sequencia_etapas("card-1", dados_base(
            tipo_pessoa="pj", cpf_cnpj="11222333000181", nome="Loja X Ltda"))
        _, url, corpo = etapas[0]
        self.assertTrue(url.endswith("/dadosContratante/pj"))
        self.assertEqual(corpo["razaoSocial"], "Loja X Ltda")
        self.assertEqual(corpo["cnpj"], "11222333000181")
        self.assertNotIn("nomeCompleto", corpo)

    def test_contratante_pf(self):
        _, _, corpo = axs_api.sequencia_etapas("card-1", dados_base())[0]
        self.assertEqual(corpo["nomeCompleto"], "João da Silva")
        self.assertEqual(corpo["cpf"], "12345678901")
        self.assertEqual(corpo["dataNascimento"], "01/02/1990")
        self.assertEqual(corpo["idCard"], "card-1")

    def test_endereco_carrega_idcard(self):
        _, _, corpo = axs_api.sequencia_etapas("card-1", dados_base())[1]
        self.assertEqual(corpo, {
            "idCard": "card-1", "cep": "74000000", "logradouro": "Rua A",
            "numero": "10", "complemento": "quadra 2", "bairro": "Centro",
            "cidade": "Goiânia", "estado": "GO",
        })

    def test_fatura(self):
        _, _, corpo = axs_api.sequencia_etapas("card-1", dados_base())[2]
        self.assertEqual(corpo["classe"], "Residencial")
        self.assertEqual(corpo["subClasse"], "B1")
        self.assertEqual(corpo["diaVencimento"], "10")
        self.assertEqual(corpo["unidadeConsumidora"], "123456")
        self.assertEqual(corpo["fatura"], "")

    def test_historico_meses(self):
        _, _, corpo = axs_api.sequencia_etapas("card-1", dados_base())[3]
        self.assertEqual(corpo["consumoJan"], 300)
        self.assertEqual(corpo["consumoDez"], 300)
        self.assertEqual(corpo["fatura"]["geracaoPropria"], False)
        self.assertEqual(corpo["fatura"]["gerPropriaMai"], 0)

    def test_aceite(self):
        _, _, corpo = axs_api.sequencia_etapas("card-1", dados_base())[4]
        self.assertEqual(corpo, {"aceiteProposta": 1, "idCard": "card-1"})


class TestCriarProposta(unittest.TestCase):
    def test_sucesso_total(self):
        http = HttpFalso({"/csp/usuario/criar/": (201, {"idCard": "card-99"})})
        status, corpo = axs_api.criar_proposta(dados_base(), REPRESENTANTE, http)
        self.assertEqual(status, 200)
        self.assertEqual(corpo["idCard"], "card-99")
        self.assertNotIn("parcial", corpo)
        # 1 criar + 5 etapas
        self.assertEqual(len(http.chamadas), 6)
        self.assertEqual(http.chamadas[0]["url"].rstrip("/").endswith("/csp/usuario/criar"), True)

    def test_criar_falhou_nao_tenta_as_outras(self):
        http = HttpFalso({"/csp/usuario/criar/": (400, {"retorno": "dados inválidos"})})
        status, corpo = axs_api.criar_proposta(dados_base(), REPRESENTANTE, http)
        self.assertGreaterEqual(status, 400)
        self.assertNotIn("idCard", corpo)
        self.assertEqual(len(http.chamadas), 1)
        self.assertIn("criar", corpo.get("erro", "").lower())

    def test_etapa_intermediaria_falha_vira_parcial_com_idcard(self):
        http = HttpFalso({
            "/csp/usuario/criar/": (201, {"idCard": "card-7"}),
            "enderecoConsumo": (422, {"retorno": "CEP inválido"}),
        })
        status, corpo = axs_api.criar_proposta(dados_base(), REPRESENTANTE, http)
        self.assertEqual(status, 200)
        self.assertEqual(corpo["idCard"], "card-7")
        self.assertTrue(corpo.get("parcial"))
        self.assertEqual(corpo.get("etapa"), "endereco")
        self.assertIn("CEP inválido", corpo.get("erro", ""))

    def test_resposta_sem_idcard_e_erro(self):
        http = HttpFalso({"/csp/usuario/criar/": (200, {"ok": True})})
        status, corpo = axs_api.criar_proposta(dados_base(), REPRESENTANTE, http)
        self.assertGreaterEqual(status, 400)
        self.assertIn("idCard", corpo.get("erro", ""))

    def test_excecao_de_rede_nao_propaga(self):
        def http(metodo, url, corpo=None):
            if "criar" in url:
                raise OSError("rede fora")
            return 200, {}
        status, corpo = axs_api.criar_proposta(dados_base(), REPRESENTANTE, http)
        self.assertGreaterEqual(status, 400)
        self.assertIn("rede fora", corpo.get("erro", ""))


if __name__ == "__main__":
    unittest.main()
