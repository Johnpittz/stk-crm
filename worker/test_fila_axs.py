#!/usr/bin/env python3
"""Fase 3 / C3 — processador da fila de propostas AXS (docs/plano-acao-modulos.md).

Sem rede e sem Supabase: toda a I/O entra por `deps` injetado.
"""
import unittest
from datetime import datetime, timedelta, timezone

import fila_axs

AGORA = datetime(2026, 9, 27, 12, 0, 0, tzinfo=timezone.utc)


def item(**kw):
    base = {
        "id": "fila-1",
        "cliente_id": "cli-1",
        "oportunidade_id": "opp-1",
        "vendedor_id": "ven-1",
        "status": "pendente",
        "tentativas": 0,
        "max_tentativas": 6,
        "job_id": None,
        "proxima_tentativa": AGORA.isoformat(),
        "payload": {"nome": "João da Silva"},
    }
    base.update(kw)
    return base


def futuro(segundos):
    return (AGORA + timedelta(seconds=segundos)).isoformat()


# ─── backoff ──────────────────────────────────────────────────────────

class TestBackoff(unittest.TestCase):
    def test_cresce_exponencialmente_com_teto(self):
        self.assertEqual(fila_axs.backoff_segundos(1), 60)
        self.assertEqual(fila_axs.backoff_segundos(2), 120)
        self.assertEqual(fila_axs.backoff_segundos(3), 240)
        self.assertEqual(fila_axs.backoff_segundos(10), fila_axs.BACKOFF_MAX_SEG)

    def test_tentativa_zero_nao_espera(self):
        self.assertEqual(fila_axs.backoff_segundos(0), 0)
        self.assertEqual(fila_axs.backoff_segundos(-1), 0)


# ─── decisão ──────────────────────────────────────────────────────────

class TestDecisao(unittest.TestCase):
    def test_estados_resolvidos_sao_ignorados(self):
        for status in ("criada", "manual", "erro"):
            self.assertIsNone(fila_axs.decisao(item(status=status), AGORA), status)

    def test_pendente_vencido_sem_job_envia(self):
        self.assertEqual(fila_axs.decisao(item(), AGORA), {"acao": "enviar"})

    def test_pendente_futuro_nao_faz_nada(self):
        self.assertIsNone(fila_axs.decisao(item(proxima_tentativa=futuro(30)), AGORA))

    def test_pendente_com_job_aberto_consulta_em_vez_de_reenviar(self):
        # evita criar a mesma proposta duas vezes na AXS
        self.assertEqual(
            fila_axs.decisao(item(status="pendente", job_id="job-1"), AGORA),
            {"acao": "consultar"},
        )

    def test_pendente_sem_tentativas_restantes_falha(self):
        d = fila_axs.decisao(item(tentativas=6, max_tentativas=6), AGORA)
        self.assertEqual(d["acao"], "falhar")

    def test_enviando_com_job_consulta(self):
        self.assertEqual(
            fila_axs.decisao(item(status="enviando", job_id="job-1"), AGORA),
            {"acao": "consultar"},
        )

    def test_enviando_sem_job_reenvia(self):
        self.assertEqual(fila_axs.decisao(item(status="enviando"), AGORA), {"acao": "enviar"})

    def test_enviando_sem_job_no_limite_falha(self):
        d = fila_axs.decisao(
            item(status="enviando", tentativas=6, max_tentativas=6), AGORA
        )
        self.assertEqual(d["acao"], "falhar")


# ─── transições ───────────────────────────────────────────────────────

class TestTransicaoEnvio(unittest.TestCase):
    def test_2xx_com_job_vai_para_enviando(self):
        patch = fila_axs.transicao_envio(item(), 200, {"job_id": "job-9"}, AGORA)
        self.assertEqual(patch["status"], "enviando")
        self.assertEqual(patch["job_id"], "job-9")
        self.assertEqual(patch["tentativas"], 1)
        self.assertGreater(
            datetime.fromisoformat(patch["proxima_tentativa"]), AGORA
        )

    def test_2xx_sem_job_mas_com_card_confirma_na_hora(self):
        patch = fila_axs.transicao_envio(
            item(), 200, {"status": "completed", "card_id": "card-1"}, AGORA
        )
        self.assertEqual(patch["status"], "criada")
        self.assertEqual(patch["axs_card_id"], "card-1")

    def test_erro_http_volta_para_pendente_com_backoff(self):
        patch = fila_axs.transicao_envio(item(), 502, {"error": "VPS fora"}, AGORA)
        self.assertEqual(patch["status"], "pendente")
        self.assertEqual(patch["tentativas"], 1)
        self.assertIn("VPS fora", patch["erro"])
        self.assertEqual(
            datetime.fromisoformat(patch["proxima_tentativa"]),
            AGORA + timedelta(seconds=60),
        )

    def test_erro_http_na_ultima_tentativa_vira_erro(self):
        patch = fila_axs.transicao_envio(
            item(tentativas=5, max_tentativas=6), 502, {"error": "x"}, AGORA
        )
        self.assertEqual(patch["status"], "erro")
        self.assertEqual(patch["tentativas"], 6)

    def test_bloqueio_de_rede_conta_como_tentativa(self):
        patch = fila_axs.transicao_envio(item(), 0, {"error": "URLError: timeout"}, AGORA)
        self.assertEqual(patch["status"], "pendente")
        self.assertEqual(patch["tentativas"], 1)


class TestTransicaoJob(unittest.TestCase):
    def test_job_ok_confirma_criacao(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1"), 200,
            {"status": "completed", "card_id": "card-2"}, AGORA,
        )
        self.assertEqual(patch["status"], "criada")
        self.assertEqual(patch["axs_card_id"], "card-2")
        self.assertIsNone(patch["erro"])

    def test_job_falhou_limpa_o_job_e_tenta_de_novo(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1"), 200,
            {"status": "failed", "message": "Playwright travou"}, AGORA,
        )
        self.assertEqual(patch["status"], "pendente")
        self.assertIsNone(patch["job_id"])
        self.assertEqual(patch["tentativas"], 1)
        self.assertIn("Playwright", patch["erro"])

    def test_job_falhou_no_limite_vira_erro(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1", tentativas=5, max_tentativas=6),
            200, {"status": "failed"}, AGORA,
        )
        self.assertEqual(patch["status"], "erro")

    def test_job_ainda_rodando_agenda_outra_consulta(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1"), 200,
            {"status": "running"}, AGORA,
        )
        self.assertEqual(patch["status"], "enviando")
        self.assertEqual(patch["tentativas"], 1)
        self.assertEqual(patch["job_id"], "job-1")

    def test_job_rodando_no_limite_vira_erro_mas_guarda_o_job(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1", tentativas=5, max_tentativas=6),
            200, {"status": "running"}, AGORA,
        )
        self.assertEqual(patch["status"], "erro")
        self.assertEqual(patch["job_id"], "job-1")

    def test_consulta_inacessivel_faz_backoff_sem_perder_o_job(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1"), 0, {"error": "timeout"}, AGORA
        )
        self.assertEqual(patch["status"], "enviando")
        self.assertEqual(patch["job_id"], "job-1")
        self.assertEqual(patch["tentativas"], 1)

    def test_consulta_inacessivel_no_limite_vira_erro(self):
        patch = fila_axs.transicao_job(
            item(status="enviando", job_id="job-1", tentativas=5, max_tentativas=6),
            0, {"error": "timeout"}, AGORA,
        )
        self.assertEqual(patch["status"], "erro")


class TestLeituraResultadoJob(unittest.TestCase):
    def test_termos_de_sucesso(self):
        for corpo in ({"status": "completed"}, {"status": "done"}, {"status": "OK"},
                      {"estado": "success"}, {"card_id": "abc"}):
            self.assertEqual(fila_axs.ler_resultado_job(corpo), "ok", corpo)

    def test_termos_de_falha(self):
        for corpo in ({"status": "failed"}, {"status": "error"}, {"estado": "erro"},
                      {"result": "failure"}):
            self.assertEqual(fila_axs.ler_resultado_job(corpo), "falhou", corpo)

    def test_termos_em_andamento_e_desconhecido(self):
        for corpo in ({"status": "running"}, {"status": "pending"},
                      {"status": "processando"}, {}, None, "texto livre", 42):
            self.assertEqual(fila_axs.ler_resultado_job(corpo), "rodando", corpo)


# ─── retroalimentação do funil ────────────────────────────────────────

class TestDeveAvancarEtapa(unittest.TestCase):
    def test_so_etapas_anteriores(self):
        self.assertTrue(fila_axs.deve_avancar_etapa("recebeu_conta"))
        self.assertTrue(fila_axs.deve_avancar_etapa("proposta_a_fazer"))
        self.assertFalse(fila_axs.deve_avancar_etapa("proposta_apresentada"))
        self.assertFalse(fila_axs.deve_avancar_etapa("contrato_assinado"))
        self.assertFalse(fila_axs.deve_avancar_etapa(None))
        self.assertFalse(fila_axs.deve_avancar_etapa(""))


# ─── ciclo completo com deps fake ─────────────────────────────────────

class DepsFake:
    """Grava tudo que o processador tentaria fazer no mundo real."""

    def __init__(self, itens=None, envio=None, consulta=None, falhar_envio=False):
        self.itens = itens if itens is not None else []
        self.envio = envio if envio is not None else (200, {"job_id": "job-1"})
        self.consulta = consulta if consulta is not None else (200, {"status": "running"})
        self.falhar_envio = falhar_envio
        self.envios = []
        self.consultas = []
        self.atualizacoes = []
        self.notificacoes = []
        self.funil = []
        self.mensalidades = []

    def buscar(self, agora, limite):
        return list(self.itens)

    def enviar(self, item):
        if self.falhar_envio:
            raise RuntimeError("rede fora")
        # grava o payload: é o que a rota /api/axs/send recebe como dados_proposta
        self.envios.append(item.get("payload"))
        return self.envio

    def consultar(self, job_id):
        self.consultas.append(job_id)
        return self.consulta

    def atualizar(self, item_id, patch):
        self.atualizacoes.append((item_id, patch))

    def notificar(self, item, erro):
        self.notificacoes.append((item["id"], erro))

    def avancar_funil(self, item):
        self.funil.append(item["id"])
        return True

    def salvar_mensalidade(self, item, valor):
        self.mensalidades.append((item["cliente_id"], valor))


class TestProcessarFila(unittest.TestCase):
    def test_lista_vazia_nao_faz_nada(self):
        deps = DepsFake(itens=[])
        self.assertEqual(fila_axs.processar_fila(agora=AGORA, deps=deps), [])
        self.assertEqual(deps.envios, [])
        self.assertEqual(deps.atualizacoes, [])

    def test_pendente_vencido_e_enviado_para_a_app(self):
        deps = DepsFake(itens=[item()])
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.envios, [{"nome": "João da Silva"}])
        self.assertEqual(len(deps.atualizacoes), 1)
        _, patch = deps.atualizacoes[0]
        self.assertEqual(patch["status"], "enviando")
        self.assertEqual(patch["job_id"], "job-1")

    def test_item_agendado_para_o_futuro_e_ignorado(self):
        deps = DepsFake(itens=[item(proxima_tentativa=futuro(120))])
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.envios, [])
        self.assertEqual(deps.atualizacoes, [])

    def test_job_finalizado_confirma_e_avanca_o_funil(self):
        deps = DepsFake(
            itens=[item(status="enviando", job_id="job-1", tentativas=1)],
            consulta=(200, {"status": "completed", "card_id": "card-7"}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.consultas, ["job-1"])
        self.assertEqual(deps.envios, [])
        _, patch = deps.atualizacoes[0]
        self.assertEqual(patch["status"], "criada")
        self.assertEqual(patch["axs_card_id"], "card-7")
        self.assertEqual(deps.funil, ["fila-1"])

    def test_falha_definitiva_notifica_o_vendedor(self):
        deps = DepsFake(
            itens=[item(tentativas=5, max_tentativas=6)],
            envio=(502, {"error": "axs-api não responde"}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        _, patch = deps.atualizacoes[0]
        self.assertEqual(patch["status"], "erro")
        self.assertEqual(len(deps.notificacoes), 1)
        self.assertIn("axs-api", deps.notificacoes[0][1])

    def test_excecao_no_envio_nao_derruba_o_lote(self):
        item_bom = item(id="fila-2", cliente_id="cli-2")
        deps = DepsFake(itens=[item(id="fila-1"), item_bom], falhar_envio=True)
        relatorio = fila_axs.processar_fila(agora=AGORA, deps=deps)
        # o primeiro item falhou, o lote continuou
        self.assertEqual(len(relatorio), 2)
        self.assertEqual(relatorio[0]["status"], "erro")
        self.assertEqual(deps.envios, [])

    def test_falha_no_seek_tambem_e_reportada_sem_lancar(self):
        class DepsQuebrado(DepsFake):
            def buscar(self, agora, limite):
                raise RuntimeError("Supabase fora")

        relatorio = fila_axs.processar_fila(agora=AGORA, deps=DepsQuebrado())
        self.assertEqual(len(relatorio), 1)
        self.assertEqual(relatorio[0]["status"], "erro_ciclo")


class TestMensalidadeAoCriar(unittest.TestCase):
    """Passo 9 do guia: criada na AXS -> mensalidade gravada no cliente.

    A AXS devolve `mensalidade_axs` no ato do criar/card; o worker derrubava
    esse valor (só guardava o idCard), então a tela nunca mostrava R$.
    """

    def test_criada_com_mensalidade_grava_no_cliente(self):
        deps = DepsFake(
            itens=[item()],
            envio=(201, {"idCard": "card-9", "mensalidade_axs": "767,88"}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        _, patch = deps.atualizacoes[0]
        self.assertEqual(patch["status"], "criada")
        self.assertEqual(deps.mensalidades, [("cli-1", 767.88)])

    def test_aceita_tambem_valor_numerico_e_milhares(self):
        deps = DepsFake(
            itens=[item()],
            envio=(201, {"idCard": "card-9", "mensalidade_axs": "1.234,56"}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.mensalidades, [("cli-1", 1234.56)])

        deps2 = DepsFake(
            itens=[item()],
            envio=(201, {"idCard": "card-10", "mensalidade_axs": 812.5}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps2)
        self.assertEqual(deps2.mensalidades, [("cli-1", 812.5)])

    def test_criada_sem_mensalidade_nao_grava_nada(self):
        deps = DepsFake(itens=[item()], envio=(201, {"idCard": "card-9"}))
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.mensalidades, [])

    def test_lixo_no_campo_nao_vira_gravacao(self):
        deps = DepsFake(
            itens=[item()],
            envio=(201, {"idCard": "card-9", "mensalidade_axs": "abc"}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.mensalidades, [])

    def test_falha_nunca_grava_mensalidade(self):
        deps = DepsFake(
            itens=[item(tentativas=5, max_tentativas=6)],
            envio=(500, {"erro": "axs fora", "mensalidade_axs": 999}),
        )
        fila_axs.processar_fila(agora=AGORA, deps=deps)
        self.assertEqual(deps.mensalidades, [])


class TestRespostaDaApiAxs(unittest.TestCase):
    """Fila x axs_api: {idCard} na resposta da API real (sem Playwright)."""

    def test_idcard_vira_criada(self):
        p = fila_axs.transicao_envio(item(), 201, {"idCard": "card-42"}, AGORA)
        self.assertEqual(p["status"], "criada")
        self.assertEqual(p["axs_card_id"], "card-42")
        self.assertIsNone(p["erro"])

    def test_parcial_fica_criada_com_erro_visivel(self):
        p = fila_axs.transicao_envio(
            item(), 200,
            {"idCard": "card-42", "parcial": True, "etapa": "endereco",
             "erro": "endereco: CEP inválido"},
            AGORA)
        self.assertEqual(p["status"], "criada")
        self.assertEqual(p["axs_card_id"], "card-42")
        self.assertIn("CEP inválido", p["erro"])

    def test_criar_falhou_repete_com_backoff(self):
        p = fila_axs.transicao_envio(item(), 400, {"erro": "criar: dados inválidos"}, AGORA)
        self.assertEqual(p["status"], "pendente")
        self.assertIn("criar", p["erro"])
        self.assertEqual(p["tentativas"], 1)


class TestEnvioReal(unittest.TestCase):

    def test_sem_credenciais_nao_envia(self):
        email, senha = fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA
        fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA = "", ""
        try:
            status, corpo = fila_axs._enviar(item())
            self.assertGreaterEqual(status, 400)
            self.assertIn("AXS_ARP", corpo.get("error", ""))
        finally:
            fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA = email, senha

    def test_enviar_repassa_credenciais_e_idcard(self):
        email, senha = fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA
        fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA = "m@x.com", "segredo"
        original = fila_axs.axs_api.criar_da_fila
        chamado = {}

        def falso(dados, credenciais, http=None):
            chamado["credenciais"] = credenciais
            chamado["dados"] = dados
            return 201, {"idCard": "c1"}

        fila_axs.axs_api.criar_da_fila = falso
        try:
            status, corpo = fila_axs._enviar(item())
            self.assertEqual(status, 201)
            self.assertEqual(chamado["credenciais"],
                             {"email": "m@x.com", "senha": "segredo"})
            # criar_da_fila recebe a LINHA da fila e puxa o payload
            self.assertEqual(chamado["dados"]["payload"], {"nome": "João da Silva"})
            self.assertEqual(chamado["dados"]["cliente_id"], "cli-1")
            self.assertEqual(corpo["idCard"], "c1")
        finally:
            fila_axs.axs_api.criar_da_fila = original
            fila_axs.AXS_ARP_EMAIL, fila_axs.AXS_ARP_SENHA = email, senha


if __name__ == "__main__":
    unittest.main()
