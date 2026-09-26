#!/usr/bin/env python3
"""Testes do agendador único do worker (F0.2 — docs/plano-acao-modulos.md).

TDD: este arquivo foi escrito ANTES do agendador.py (RED).
Sem rede, sem Supabase: toda I/O entra por callables injetadas.
"""

import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agendador as ag

AGORA = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)


def iso(dt):
    return dt.isoformat()


def rotina(nome="preparacao_remarketing", ativa=True, proxima=None, ultima=None,
           intervalo=24.0, **extra):
    r = {
        "id": extra.pop("id", "rot-1"),
        "nome": nome,
        "ativa": ativa,
        "intervalo_horas": intervalo,
        "proxima_execucao": iso(proxima) if isinstance(proxima, datetime) else proxima,
        "ultima_execucao": iso(ultima) if isinstance(ultima, datetime) else ultima,
        "config": {},
    }
    r.update(extra)
    return r


class TestDeveExecutar(unittest.TestCase):
    def test_inativa_nao_roda(self):
        self.assertFalse(ag.deve_executar(rotina(ativa=False), AGORA))

    def test_proxima_no_passado_roda(self):
        self.assertTrue(ag.deve_executar(rotina(proxima=AGORA - timedelta(minutes=1)), AGORA))

    def test_proxima_no_futuro_nao_roda(self):
        self.assertFalse(ag.deve_executar(rotina(proxima=AGORA + timedelta(hours=1)), AGORA))

    def test_sem_proxima_roda(self):
        # primeira execução / registro recém-criado
        self.assertTrue(ag.deve_executar(rotina(proxima=None), AGORA))

    def test_proxima_vem_como_string_iso_do_postgrest(self):
        r = rotina(proxima=AGORA - timedelta(hours=2))
        self.assertIsInstance(r["proxima_execucao"], str)
        self.assertTrue(ag.deve_executar(r, AGORA))


class TestProximaExecucao(unittest.TestCase):
    def test_soma_intervalo_a_partir_de_agora(self):
        self.assertEqual(
            ag.proxima_execucao(AGORA, 24.0),
            AGORA + timedelta(hours=24),
        )

    def test_intervalo_padrao_quando_invalido(self):
        self.assertEqual(ag.proxima_execucao(AGORA, None), AGORA + timedelta(hours=24))
        self.assertEqual(ag.proxima_execucao(AGORA, 0), AGORA + timedelta(hours=24))


class TestExecutarRotinas(unittest.TestCase):
    def setUp(self):
        self.salvos = []

    def salvar(self, rotina_id, patch):
        self.salvos.append((rotina_id, patch))

    def handler_ok(self, rotina_, agora, ctx):
        return {"resumo": f"{rotina_['nome']}: 3 pendentes", "acoes": []}

    def test_dry_run_nao_persiste(self):
        rel = ag.executar_rotinas(
            [rotina(proxima=AGORA - timedelta(hours=1))],
            AGORA,
            handlers={"preparacao_remarketing": self.handler_ok},
            dry_run=True,
            salvar=self.salvar,
        )
        self.assertEqual(self.salvos, [])
        self.assertEqual(rel[0]["status"], "dry_run")
        self.assertIn("3 pendentes", rel[0]["resumo"])

    def test_execucao_real_marca_ultima_e_proxima(self):
        rel = ag.executar_rotinas(
            [rotina(proxima=AGORA - timedelta(hours=1), intervalo=6.0)],
            AGORA,
            handlers={"preparacao_remarketing": self.handler_ok},
            dry_run=False,
            salvar=self.salvar,
        )
        self.assertEqual(rel[0]["status"], "ok")
        self.assertEqual(len(self.salvos), 1)
        _, patch = self.salvos[0]
        self.assertEqual(patch["ultima_execucao"], iso(AGORA))
        self.assertEqual(patch["proxima_execucao"], iso(AGORA + timedelta(hours=6)))

    def test_rotina_vencida_mas_sem_handler_nao_marca_execucao(self):
        rel = ag.executar_rotinas(
            [rotina(proxima=AGORA - timedelta(minutes=1))],
            AGORA,
            handlers={},
            dry_run=False,
            salvar=self.salvar,
        )
        self.assertEqual(rel[0]["status"], "sem_handler")
        self.assertEqual(self.salvos, [])

    def test_handler_que_falha_nao_derruba_o_lote(self):
        def ruim(r, a, c):
            raise RuntimeError("boom")

        rel = ag.executar_rotinas(
            [
                rotina(id="a", nome="preparacao_remarketing", proxima=AGORA - timedelta(hours=1)),
                rotina(id="b", nome="preparacao_alerta_kanban", proxima=AGORA - timedelta(hours=1)),
            ],
            AGORA,
            handlers={"preparacao_remarketing": ruim,
                      "preparacao_alerta_kanban": self.handler_ok},
            dry_run=False,
            salvar=self.salvar,
        )
        self.assertEqual(rel[0]["status"], "erro")
        self.assertIn("boom", rel[0]["erro"])
        self.assertEqual(rel[1]["status"], "ok")
        self.assertEqual(len(self.salvos), 1)

    def test_rotina_inativa_e_nao_vencida_sao_ignoradas_sem_toque(self):
        rel = ag.executar_rotinas(
            [rotina(ativa=False), rotina(id="b", proxima=AGORA + timedelta(hours=5))],
            AGORA,
            handlers={"preparacao_remarketing": self.handler_ok},
            dry_run=False,
            salvar=self.salvar,
        )
        self.assertEqual([r["status"] for r in rel], ["ignorada", "ignorada"])
        self.assertEqual(self.salvos, [])

    def test_sem_salvar_na_chamada(self):
        # modo dry-run é o padrão de segurança: quem chama precisa pedir de propósito
        rel = ag.executar_rotinas(
            [rotina(proxima=AGORA - timedelta(hours=1))],
            AGORA,
            handlers={"preparacao_remarketing": self.handler_ok},
        )
        self.assertEqual(rel[0]["status"], "dry_run")


class TestRegistro(unittest.TestCase):
    def test_registrar_e_consultar(self):
        ag.registrar("rotina_x", "descrição", lambda r, a, c: {"resumo": "ok"})
        self.assertIn("rotina_x", ag.ROTINAS)
        self.assertEqual(ag.ROTINAS["rotina_x"]["descricao"], "descrição")

    def test_rotinas_pre_registradas_existem(self):
        # os dois handlers da Fase 0 vêm de fábrica (modo leitura/contagem)
        for nome in ("preparacao_remarketing", "preparacao_alerta_kanban"):
            ag.registrar(nome, "x", lambda r, a, c: {"resumo": "ok"})
            self.assertIn(nome, ag.ROTINAS)


if __name__ == "__main__":
    unittest.main()
