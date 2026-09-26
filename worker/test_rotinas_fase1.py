#!/usr/bin/env python3
"""Fase 1 / C2 — produtor do alerta de kanban parado (docs/plano-acao-modulos.md).

TDD: este arquivo foi escrito ANTES do handler (RED).
Sem rede: toda I/O entra pelo callable `ctx["rest"]`, que tem a mesma
assinatura de supabase_rest(method, table, query, payload).

Cortes de segurança exercitados aqui:
  - config.dry_run == True é o PADRÃO (nada é enviado sem pedido explícito);
  - anti-spam: a mesma oportunidade só gera novo alerta depois que MUDAR;
  - etapa final (comissao_paga) nunca alerta;
  - limite por etapa configurável (por_etapa) e teto de lote (max_alertas).
"""

import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import disparo_worker_waha as w

AGORA = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)


def horas_iso(h):
    return (AGORA - timedelta(hours=h)).isoformat()


def opp(id="opp-1", etapa="recebeu_conta", paradas_h=80, **extra):
    o = {
        "id": id,
        "titulo": f"Oportunidade {id}",
        "cliente_nome": f"Cliente {id}",
        "etapa": etapa,
        "updated_at": horas_iso(paradas_h),
        "vendedor_id": "vend-1",
    }
    o.update(extra)
    return o


class FakeRest:
    """Roteia as chamadas do handler por tabela/método."""

    def __init__(self, oportunidades=None, alertas=None, perfis=None,
                 falha_em=None):
        self.oportunidades = oportunidades if oportunidades is not None else []
        self.alertas = alertas if alertas is not None else []
        # o alerta é do DONO + gestores: dono das fixtures + 1 gestor
        self.perfis = perfis if perfis is not None else [
            {"id": "vend-1", "cargo": "vendedor"},
            {"id": "g1", "cargo": "admin"},
        ]
        self.falha_em = falha_em
        self.posts = []
        self.chamadas = []

    def __call__(self, method, table, query="", payload=None):
        self.chamadas.append({"method": method, "table": table,
                              "query": query, "payload": payload})
        if self.falha_em == table:
            return 500, "erro interno"
        if table == "oportunidades":
            return 200, self.oportunidades
        if table == "profiles":
            return 200, self.perfis
        if table == "notificacoes" and method == "GET":
            return 200, self.alertas
        if table == "notificacoes" and method == "POST":
            self.posts.append(payload)
            return 201, payload
        return 404, "tabela desconhecida"

    @property
    def linhas_postadas(self):
        return [linha for lote in self.posts for linha in lote]

    @property
    def query_oportunidades(self):
        for c in self.chamadas:
            if c["table"] == "oportunidades":
                return c["query"]
        return ""


def rodar(config, rest, rotina_id="r1"):
    rotina = {"id": rotina_id, "nome": "preparacao_alerta_kanban",
              "ativa": True, "intervalo_horas": 24, "config": config}
    return w.handler_oportunidades_paradas(rotina, AGORA, {"rest": rest})


class TestDryRunPadrao(unittest.TestCase):
    def test_padrao_nao_envia_nada(self):
        rest = FakeRest(oportunidades=[opp()])
        r = rodar({}, rest)
        self.assertEqual(rest.posts, [])
        self.assertIn("dry_run", r["resumo"])
        self.assertEqual(r["contagem"], 1)

    def test_dry_run_true_tambem_nao_envia(self):
        rest = FakeRest(oportunidades=[opp()])
        r = rodar({"dry_run": True}, rest)
        self.assertEqual(rest.posts, [])

    def test_dry_run_false_envia_para_dono_e_gestor(self):
        rest = FakeRest(oportunidades=[opp()])   # dono padrão: vend-1
        r = rodar({"dry_run": False}, rest)
        self.assertEqual(len(rest.posts), 1)
        linhas = rest.linhas_postadas
        self.assertEqual({l["user_id"] for l in linhas}, {"vend-1", "g1"})
        for linha in linhas:
            self.assertEqual(linha["tipo"], "kanban_parado")
            self.assertEqual(linha["lida"], False)
            self.assertEqual(linha["dados"]["oportunidade_id"], "opp-1")
            self.assertIn("titulo", linha)
            self.assertIn("mensagem", linha)
        self.assertEqual(r["alertas"], 1)


class TestAntiSpam(unittest.TestCase):
    def test_nao_repete_alerta_enquanto_a_oportunidade_nao_mudar(self):
        # alerta emitido DEPOIS da última mudança dela = já avisada
        alerta = {"dados": {"oportunidade_id": "opp-1"},
                  "created_at": horas_iso(10)}
        rest = FakeRest(oportunidades=[opp(paradas_h=80)], alertas=[alerta])
        r = rodar({"dry_run": False}, rest)
        self.assertEqual(rest.posts, [])
        self.assertEqual(r["alertas"], 0)

    def test_alerta_mais_antigo_que_a_ultima_mudanca_gera_aviso_novo(self):
        # a oportunidade mudou DEPOIS do alerta → pode avisar de novo
        alerta = {"dados": {"oportunidade_id": "opp-1"},
                  "created_at": horas_iso(200)}
        rest = FakeRest(oportunidades=[opp(paradas_h=80)], alertas=[alerta])
        r = rodar({"dry_run": False}, rest)
        self.assertEqual(len(rest.posts), 1)
        self.assertEqual(r["alertas"], 1)

    def test_alerta_deoutra_oportunidade_nao_bloqueia(self):
        alerta = {"dados": {"oportunidade_id": "outra"},
                  "created_at": horas_iso(10)}
        rest = FakeRest(oportunidades=[opp()], alertas=[alerta])
        rodar({"dry_run": False}, rest)
        self.assertEqual(len(rest.posts), 1)

    def test_alerta_sem_dados_validos_e_ignorado_sem_quebrar(self):
        alerta = {"dados": None, "created_at": horas_iso(10)}
        rest = FakeRest(oportunidades=[opp()], alertas=[alerta])
        rodar({"dry_run": False}, rest)
        self.assertEqual(len(rest.posts), 1)


class TestRegraPorEtapa(unittest.TestCase):
    def test_limite_configuravel_por_etapa(self):
        cfg = {"dry_run": False, "por_etapa": {"recebeu_conta": 24}}
        rest = FakeRest(oportunidades=[
            opp(id="rapida", etapa="recebeu_conta", paradas_h=30),
            opp(id="devagar", etapa="proposta_feita", paradas_h=30),
        ])
        r = rodar(cfg, rest)
        self.assertEqual(r["contagem"], 1)
        ids = [l["dados"]["oportunidade_id"] for l in rest.linhas_postadas]
        self.assertEqual(set(ids), {"rapida"})   # 1 parada x N perfis = N linhas

    def test_etapa_final_nunca_alerta_mesmo_velha(self):
        rest = FakeRest(oportunidades=[opp(etapa="comissao_paga", paradas_h=500)])
        r = rodar({"dry_run": False}, rest)
        self.assertEqual(rest.posts, [])
        self.assertEqual(r["contagem"], 0)

    def test_query_pede_somente_etapas_abertas_e_sem_sinal_mais(self):
        rest = FakeRest(oportunidades=[])
        rodar({}, rest)
        q = rest.query_oportunidades
        self.assertIn("etapa=neq.comissao_paga", q)
        self.assertIn("updated_at=lte.", q)
        self.assertNotIn("+", q)  # '+' vira espaço na query string (bug 26/09)
        self.assertTrue(q.endswith("limit=200") or "limit=" in q)


class TestTetoELotes(unittest.TestCase):
    def test_max_alertas_corta_o_lote_pelo_mais_antigo(self):
        cfg = {"dry_run": False, "max_alertas": 2}
        rest = FakeRest(oportunidades=[
            opp(id="novo", paradas_h=80),
            opp(id="velho", paradas_h=300),
            opp(id="medio", paradas_h=150),
        ])
        r = rodar(cfg, rest)
        linhas = rest.linhas_postadas
        ids = {l["dados"]["oportunidade_id"] for l in linhas}
        self.assertEqual(ids, {"velho", "medio"})   # só as 2 mais antigas
        self.assertEqual(r["alertas"], 2)
        self.assertEqual(r["cortadas"], 1)

    def test_um_lote_por_usuario_com_chaves_iguais(self):
        rest = FakeRest(oportunidades=[opp(), opp(id="opp-2")],
                        perfis=[{"id": "vend-1", "cargo": "vendedor"}])
        rodar({"dry_run": False}, rest)
        self.assertEqual(len(rest.posts), 1)          # 1 insert (lote)
        self.assertEqual(len(rest.linhas_postadas), 2)  # 1 linha por parada
        chaves = [set(l.keys()) for l in rest.linhas_postadas]
        self.assertEqual(len(set(map(frozenset, chaves))), 1)  # PostgREST exige


class TestFalhas(unittest.TestCase):
    def test_falha_na_query_nao_lanca_e_nao_envia(self):
        rest = FakeRest(falha_em="oportunidades")
        r = rodar({"dry_run": False}, rest)  # não deve lançar
        self.assertEqual(rest.posts, [])
        self.assertIn("falha", r["resumo"].lower())

    def test_sem_audiencia_nao_envia(self):
        # dono não existe mais em profiles e não há gestor → nada a notificar
        rest = FakeRest(oportunidades=[opp()], perfis=[])
        r = rodar({"dry_run": False}, rest)
        self.assertEqual(rest.posts, [])
        self.assertEqual(r["alertas"], 0)
        self.assertIn("destinat", r["resumo"].lower())

    def test_parada_sem_dono_valido_vai_somente_para_os_gestores(self):
        rest = FakeRest(oportunidades=[opp(vendedor_id="demitido")])
        rodar({"dry_run": False}, rest)
        self.assertEqual({l["user_id"] for l in rest.linhas_postadas}, {"g1"})

    def test_config_invalida_cai_no_padrao_sem_quebrar(self):
        rest = FakeRest(oportunidades=[opp()])
        r = rodar({"parada_horas": "abc", "por_etapa": "não é mapa",
                   "max_alertas": "muitos"}, rest)
        self.assertEqual(r["contagem"], 1)


class TestRegistroRotina(unittest.TestCase):
    def test_handler_segue_registrado_no_agendador(self):
        w.registrar_rotinas()
        self.assertIn("preparacao_alerta_kanban", w.agd.ROTINAS)
        self.assertIn("preparacao_remarketing", w.agd.ROTINAS)


if __name__ == "__main__":
    unittest.main()
