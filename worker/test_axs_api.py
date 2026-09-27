#!/usr/bin/env python3
"""AXS — fluxo ARP (o de verdade), com TDD.

Fonte da verdade: captura ao vivo do assistente ARP em 27/09/2026
(payload de 1655 bytes) — ver docs/axs-fluxo-oficial.md.

Endpoints:
  POST /csp/representante/login/       -> {retorno:"OK", acessToken, informacao}
  POST /csp/representante/criar/card/  -> 201 {idCard}

Zero rede nos testes: o HTTP é injetado.
"""
import unittest

import axs_api


def sessao_de_teste() -> dict:
    """Sessão como a monta o login (informacao do representante)."""
    return {
        "token": "tk-123",
        "representante": {
            "nome": "MICHELE SANTOS DE ARAUJO",
            "email": "michele@example.com",
            "CPF": "643.804.831-34",
            "razao": "SUSTENTALSKI LTDA",
            "CNPJ": "54.989.732/0001-85",
            "codigoLink": "643.804.831-34",
            "canal": "INDIRETO",
            "tipo": "Representante Legal",
            "grupo": "GO",
            "gestor1": "RONALDO JUNIOR",
            "gestor2": "FABIO COSTA MARTINS DA SILVA",
            "origem": "REGIONAL",
            "codigoPlano": "50501000090",
        },
    }


def dados_base(**kw) -> dict:
    d = {
        "tipo_imovel": "comercio",
        "tipo_pessoa": "pf",
        "cpf_cnpj": "81245037960",
        "nome": "Teste Automatizado Stkcrm",
        "email": "teste.c3@stkcrm.test",
        "data_nascimento": "01/02/1985",
        "telefone": "(62) 99999-0000",
        "whatsapp": "",
        "cep": "74968546",
        "logradouro": "Rua Alsácia",
        "numero": "1000",
        "complemento": "Quadra 10",
        "bairro": "Residencial Solar Central Park",
        "cidade": "Aparecida de Goiânia",
        "estado": "GO",
        "concessionaria": "EQUATORIAL GO",
        "uc_instalacao": "636281132001292",
        "vencimento_dia": "10",
        "classe": "Comercial",
        "subgrupo": "B3",
        "consumo_meses": {
            "jan": "5271", "fev": "4670", "mar": "4501", "abr": "5078",
            "mai": "5821", "jun": "4859", "jul": "6224", "ago": "6037",
            "set": "6097", "out": "5128", "nov": "4555", "dez": "4026",
        },
        "geracao_propria": False,
        "geracao_meses": {},
        "observacoes": "Teste automatizado STK-CRM",
    }
    d.update(kw)
    return d


class HttpFalso:
    """Grava as chamadas e devolve respostas em fila (na ordem da chamada)."""

    def __init__(self, respostas):
        self.chamadas = []
        self.respostas = list(respostas)

    def __call__(self, metodo, url, corpo=None, headers=None):
        self.chamadas.append({"metodo": metodo, "url": url, "corpo": corpo,
                              "headers": headers or {}})
        if not self.respostas:
            raise AssertionError(f"resposta não prevista para {url}")
        return self.respostas.pop(0)

    def urls(self):
        return [c["url"] for c in self.chamadas]


class TestMapeamentos(unittest.TestCase):
    """As regras que não estão em documentação nenhuma."""

    def test_estado_vai_por_extenso(self):
        self.assertEqual(axs_api.nome_estado("GO"), "Goiás")
        self.assertEqual(axs_api.nome_estado("MT"), "Mato Grosso")

    def test_estado_desconhecido_nao_quebra(self):
        self.assertEqual(axs_api.nome_estado("XX"), "XX")

    def test_subgrupo_vira_tipo_de_conexao(self):
        # B1 monofásico, B2 bifásico, B3 trifásico (sinopse tarifária)
        self.assertEqual(axs_api.fase_da_classe({"subgrupo": "B1"}), "Monofásico")
        self.assertEqual(axs_api.fase_da_classe({"subgrupo": "B2"}), "Bifásico")
        self.assertEqual(axs_api.fase_da_classe({"subgrupo": "B3"}), "Trifásico")

    def test_subgrupo_de_alta_tensao_e_trifasico(self):
        for subgrupo in ("A1", "A2", "A3", "A3a", "A4", "AS", "BS"):
            self.assertEqual(axs_api.fase_da_classe({"subgrupo": subgrupo}),
                             "Trifásico", subgrupo)

    def test_subgrupo_vazio_ou_desconhecido_nao_quebra(self):
        self.assertEqual(axs_api.fase_da_classe({"subgrupo": ""}), "Monofásico")
        self.assertEqual(axs_api.fase_da_classe({"subgrupo": "x"}), "Monofásico")

    def test_classe_do_crm_vira_subclasse(self):
        self.assertEqual(axs_api.grupo_tarifario({"classe": "Comercial"}), "Comercial")
        self.assertEqual(axs_api.grupo_tarifario({"classe": "Rural"}), "Rural")

    def test_classe_vazia_cai_no_tipo_de_imovel(self):
        self.assertEqual(axs_api.grupo_tarifario({"classe": "", "tipo_imovel": "casa"}),
                         "Residencial")
        self.assertEqual(axs_api.grupo_tarifario({"classe": "", "tipo_imovel": "industria"}),
                         "Industrial")

    def test_classe_e_imovel_desconhecidos_caem_em_residencial(self):
        self.assertEqual(axs_api.grupo_tarifario({"classe": "", "tipo_imovel": ""}),
                         "Residencial")

    def test_tipo_imovel(self):
        self.assertEqual(axs_api.tipo_resi("casa"), "Casa/apto")
        self.assertEqual(axs_api.tipo_resi("comercio"), "Comércio")
        self.assertEqual(axs_api.tipo_resi("industria"), "Indústria")
        self.assertEqual(axs_api.tipo_resi("rural"), "Rural")

    def test_telefone_normalizado(self):
        self.assertEqual(axs_api.normalizar_telefone("62999999999"), "(62) 99999-9999")
        self.assertEqual(axs_api.normalizar_telefone(""), "")

    def test_cpf_mascarado(self):
        self.assertEqual(axs_api.mascara_cpf("81245037960"), "812.450.379-60")
        self.assertEqual(axs_api.mascara_cpf("812.450.379-60"), "812.450.379-60")
        self.assertEqual(axs_api.mascara_cpf(""), "")

    def test_cep_com_traco(self):
        self.assertEqual(axs_api.cep_mascarado("74968546"), "74968-546")
        self.assertEqual(axs_api.cep_mascarado("74968-546"), "74968-546")

    def test_nascimento_para_iso(self):
        self.assertEqual(axs_api.data_iso("01/02/1985"), "1985-02-01")
        self.assertEqual(axs_api.data_iso(""), "")


class TestMontarProposta(unittest.TestCase):
    """Payload igual ao capturado ao vivo (docs/axs-fluxo-oficial.md, seção 4)."""

    def setUp(self):
        self.p = axs_api.montar_proposta(dados_base(), sessao_de_teste())

    def test_observacoes_e_objeto_nao_texto(self):
        self.assertIsInstance(self.p["observacoes"], dict)
        self.assertEqual(self.p["observacoes"]["temperatura"], "")
        self.assertIn("Teste automatizado", self.p["observacoes"]["observacao"])

    def test_classe_e_subclasse_trocados(self):
        # ARMADILHA: classe = tipo de conexão (mono/bi/tri); subClasse = grupo
        self.assertEqual(self.p["fatura"]["classe"], "Trifásico")
        self.assertEqual(self.p["fatura"]["subClasse"], "Comercial")

    def test_consumo_vai_como_texto(self):
        self.assertEqual(self.p["fatura"]["consumoJan"], "5271")
        self.assertEqual(self.p["fatura"]["consumoDez"], "4026")

    def test_vencimento_e_numero(self):
        self.assertIsInstance(self.p["fatura"]["dataVencimentoFatura"], int)
        self.assertEqual(self.p["fatura"]["dataVencimentoFatura"], 10)

    def test_geracao_propria_zerada(self):
        f = self.p["fatura"]
        self.assertIs(f["geracaoPropria"], False)
        self.assertEqual(f["gerPropriaJan"], "0")
        self.assertEqual(f["gerPropriaDez"], "0")

    def test_bloco_da_fatura_completo(self):
        f = self.p["fatura"]
        self.assertEqual(f["faturas"], [])
        self.assertEqual(f["concessionaria"], "EQUATORIAL GO")
        self.assertEqual(f["numeroInstalacao"], "636281132001292")

    def test_representante_sem_gestor3_equipe_regional(self):
        rep = self.p["representante"]
        for proibido in ("gestor3", "equipe", "regional"):
            self.assertNotIn(proibido, rep, proibido)
        self.assertEqual(rep["codigoPlano"], "50501000090")
        self.assertEqual(rep["tipo"], "Representante Legal")

    def test_endereco_cep_traco_e_estado_extenso(self):
        self.assertEqual(self.p["endereco"]["CEP"], "74968-546")
        self.assertEqual(self.p["endereco"]["estado"], "Goiás")
        self.assertEqual(self.p["endereco"]["numero"], "1000")

    def test_pessoa_fisica_mascarada_e_iso(self):
        pf = self.p["pessoaFisica"]
        self.assertEqual(pf["CPF"], "812.450.379-60")
        self.assertEqual(pf["dataNascimento"], "1985-02-01")
        self.assertEqual(pf["nomeCompleto"], "Teste Automatizado Stkcrm")
        # o ARP manda só o bloco do tipo da pessoa (confirmado no payload real)
        self.assertNotIn("pessoaJuridica", self.p)

    def test_pessoa_juridica_envia_so_o_bloco_pj(self):
        p = axs_api.montar_proposta(
            dados_base(tipo_pessoa="pj", cpf_cnpj="11222333000181",
                       nome="Loja X Ltda"), sessao_de_teste())
        self.assertEqual(p["tipoPessoa"], "PJ")
        self.assertEqual(p["pessoaJuridica"]["CNPJ"], "11.222.333/0001-81")
        self.assertEqual(p["pessoaJuridica"]["razaoSocial"], "Loja X Ltda")
        self.assertNotIn("pessoaFisica", p)

    def test_tipo_proposta_e_tipo_de_imovel(self):
        self.assertEqual(self.p["tipoProposta"], "Comércio")
        casa = axs_api.montar_proposta(
            dados_base(tipo_imovel="casa"), sessao_de_teste())
        self.assertEqual(casa["tipoProposta"], "Casa/apto")

    def test_telefone_e_bancos(self):
        self.assertEqual(self.p["telefoneLigacao"], "(62) 99999-0000")
        self.assertEqual(self.p["dadosBancario"], {"formaPagamento": "Pix"})
        self.assertEqual(self.p["usina"], {"CRI": "", "usina": ""})

    def test_nunca_manda_o_payload_do_cru(self):
        self.assertNotIn("consumo_meses", self.p)
        self.assertNotIn("uc_instalacao", self.p)
        self.assertNotIn("cep", self.p)


class TestLogin(unittest.TestCase):
    def test_monta_corpo(self):
        self.assertEqual(axs_api.montar_login("a@b.com", "segredo"),
                         {"email": "a@b.com", "senha": "segredo"})

    def test_extrai_token_e_representante(self):
        corpo = {
            "retorno": "OK",
            "acessToken": "tk-abc",
            "informacao": {
                "nome": "MICHELE", "e_mail": "m@x.com", "cpf": "643.804.831-34",
                "raz_o_social": "SUSTENTALSKI LTDA", "cnpj": "54.989.732/0001-85",
                "tipo": "Representante Legal",
                "c_digo_do_link_verificar_com_a_bplus": "643.804.831-34",
                "canal": "INDIRETO", "grupo": "GO",
                "gerente_respons_vel": "RONALDO JUNIOR",
                "executivo_supervisor_respons_vel": "FABIO",
                "gestor_3": "", "origem": "REGIONAL",
                "plano_que_est_vendendo": "50501000090",
                "equipe_1": "", "regional": "",
            },
        }
        sessao = axs_api.extrair_sessao(corpo)
        self.assertEqual(sessao["token"], "tk-abc")
        rep = sessao["representante"]
        self.assertEqual(rep["nome"], "MICHELE")
        self.assertEqual(rep["email"], "m@x.com")
        self.assertEqual(rep["razao"], "SUSTENTALSKI LTDA")
        self.assertEqual(rep["codigoPlano"], "50501000090")
        self.assertNotIn("gestor3", rep)

    def test_resposta_sem_token_e_erro(self):
        with self.assertRaises(ValueError):
            axs_api.extrair_sessao({"retorno": "Usuário ou senha inválidos"})

    def test_sessao_ativa_tambem_erro(self):
        # 203 + chaveVerificaSessao = outra sessão aberta, não dá pra seguir
        with self.assertRaises(ValueError):
            axs_api.extrair_sessao({"chaveVerificaSessao": "abc"})

    def test_login_chama_a_rota_certa(self):
        http = HttpFalso([(200, {"retorno": "OK", "acessToken": "tk",
                                 "informacao": {"nome": "M", "e_mail": "m@x"}})])
        status, sessao = axs_api.logar("m@x.com", "senha", http=http)
        self.assertEqual(status, 200)
        self.assertEqual(sessao["token"], "tk")
        self.assertTrue(http.chamadas[0]["url"].endswith(
            "/csp/representante/login/"))
        self.assertEqual(http.chamadas[0]["corpo"],
                         {"email": "m@x.com", "senha": "senha"})


class TestCriarProposta(unittest.TestCase):
    def test_sucesso_201_devolve_idcard(self):
        http = HttpFalso([(201, {"idCard": "1451384681"})])
        status, corpo = axs_api.criar_proposta(
            dados_base(), sessao_de_teste(), http=http)
        self.assertEqual(status, 201)
        self.assertEqual(corpo["idCard"], "1451384681")

    def test_envia_token_e_tennant(self):
        http = HttpFalso([(201, {"idCard": "1"})])
        axs_api.criar_proposta(dados_base(), sessao_de_teste(), http=http)
        chamada = http.chamadas[0]
        self.assertEqual(chamada["metodo"], "POST")
        self.assertTrue(chamada["url"].endswith("/csp/representante/criar/card/"))
        self.assertEqual(chamada["headers"].get("Authorization"), "Bearer tk-123")
        self.assertEqual(chamada["headers"].get("tennant"), "ARP")

    def test_falha_nao_devolve_idcard(self):
        http = HttpFalso([(500, {"errors": [{"code": 5034}]})])
        status, corpo = axs_api.criar_proposta(
            dados_base(), sessao_de_teste(), http=http)
        self.assertGreaterEqual(status, 400)
        self.assertNotIn("idCard", corpo)

    def test_resposta_201_sem_idcard_e_erro(self):
        http = HttpFalso([(201, {})])
        status, corpo = axs_api.criar_proposta(
            dados_base(), sessao_de_teste(), http=http)
        self.assertGreaterEqual(status, 400)
        self.assertIn("erro", corpo)

    def test_excecao_de_rede_nao_propaga(self):
        def http(metodo, url, corpo=None, headers=None):
            raise OSError("rede fora")
        status, corpo = axs_api.criar_proposta(
            dados_base(), sessao_de_teste(), http=http)
        self.assertGreaterEqual(status, 400)
        self.assertIn("rede fora", corpo.get("erro", ""))


class TestCriarDaFila(unittest.TestCase):
    def setUp(self):
        axs_api.limpar_sessao()

    def tearDown(self):
        axs_api.limpar_sessao()

    def item(self):
        return {"id": "f1", "payload": dados_base()}

    def credenciais(self):
        return {"email": "m@x.com", "senha": "segredo"}

    def login_ok(self, token="tk"):
        return (200, {"retorno": "OK", "acessToken": token,
                      "informacao": {"nome": "M", "e_mail": "m@x"}})

    def test_faz_login_depois_cria(self):
        http = HttpFalso([self.login_ok(), (201, {"idCard": "777"})])
        status, corpo = axs_api.criar_da_fila(
            self.item(), self.credenciais(), http=http)
        self.assertEqual(status, 201)
        self.assertEqual(corpo["idCard"], "777")
        urls = http.urls()
        self.assertEqual(len(urls), 2)
        self.assertIn("/representante/login/", urls[0])
        self.assertIn("/representante/criar/card/", urls[1])
        self.assertIn("Bearer tk", http.chamadas[1]["headers"]["Authorization"])

    def test_segunda_chamada_reusa_sessao(self):
        http = HttpFalso([self.login_ok(), (201, {"idCard": "1"}),
                          (201, {"idCard": "2"})])
        axs_api.criar_da_fila(self.item(), self.credenciais(), http=http)
        axs_api.criar_da_fila(self.item(), self.credenciais(), http=http)
        logins = [u for u in http.urls() if "/login/" in u]
        self.assertEqual(len(logins), 1, "sessão deve ser reaproveitada")

    def test_sem_credenciais_nao_envia(self):
        status, corpo = axs_api.criar_da_fila(self.item(), {}, http=HttpFalso([]))
        self.assertGreaterEqual(status, 400)
        self.assertIn("erro", corpo)
        self.assertNotIn("idCard", corpo)

    def test_401_refaz_login_e_tenta_de_novo(self):
        http = HttpFalso([
            self.login_ok("tk-velho"),
            (401, {"retorno": "Token inválido ou sessão expirada"}),
            self.login_ok("tk-novo"),
            (201, {"idCard": "999"}),
        ])
        status, corpo = axs_api.criar_da_fila(
            self.item(), self.credenciais(), http=http)
        self.assertEqual(status, 201)
        self.assertEqual(corpo["idCard"], "999")
        self.assertIn("Bearer tk-novo", http.chamadas[3]["headers"]["Authorization"])

    def test_login_invalido_devolve_erro_sem_idcard(self):
        http = HttpFalso([(200, {"retorno": "Usuário ou senha inválidos"})])
        status, corpo = axs_api.criar_da_fila(
            self.item(), self.credenciais(), http=http)
        self.assertGreaterEqual(status, 400)
        self.assertIn("erro", corpo)
        self.assertNotIn("idCard", corpo)


if __name__ == "__main__":
    unittest.main()
