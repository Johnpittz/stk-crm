#!/usr/bin/env python3
"""Fase 2 / M1.4 — rotina diária de remarketing (docs/plano-acao-modulos.md).

TDD: este arquivo foi escrito ANTES do handler (RED). Sem rede: toda I/O
entra por ctx["rest"] (mesma assinatura de supabase_rest).

Guardas exercitadas aqui (risco real = número banido por volume):
  - config.dry_run == True é o PADRÃO (nada é criado sem pedido explícito);
  - teto diário (teto_diario);
  - cadência: 1 campanha a cada intervalo_horas_min;
  - não remarcar o MESMO telefone em nao_rematar_dias;
  - opt-out (tabela remarketing_opt_out) sempre respeitado;
  - template obrigatório antes de criar campanha;
  - falha de query não derruba o lote.
"""

import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import disparo_worker_waha as w

AGORA = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)


def atend(telefone="5562999990000", nome="Cliente", remetente="vendedor",
          horas=30, status="aberto", **extra):
    a = {
        "telefone_cliente": telefone,
        "nome_cliente": nome,
        "status": status,
        "ultima_mensagem_remetente": remetente,
        "ultima_mensagem_data": (AGORA - timedelta(hours=horas)).isoformat(),
        "instancia": "STK-3",
        "vendedor_id": "v1",
    }
    a.update(extra)
    return a


class FakeRest:
    """Roteia por tabela; distinguindo as queries de bulk_campaigns pelo select."""

    def __init__(self, atendimentos=None, opt_out=None, campanhas=None,
                 falha_em=None):
        self.atendimentos = atendimentos if atendimentos is not None else []
        self.opt_out = opt_out if opt_out is not None else []
        self.campanhas = campanhas if campanhas is not None else []
        self.falha_em = falha_em
        self.posts = []
        self.chamadas = []

    def _publico(self, query):
        """Aplica a mesma regra do PostgREST: status vivos, remetente != cliente
        (e não nulo), última mensagem antes do corte. Sem isso a fake mente."""
        corte = None
        chave = "ultima_mensagem_data=lte."
        if chave in query:
            valor = query.split(chave, 1)[1].split("&", 1)[0]
            corte = datetime.fromisoformat(valor.replace("Z", "+00:00"))
        fora = []
        for a in self.atendimentos:
            if a.get("status") not in ("aberto", "em_andamento"):
                continue
            remetente = a.get("ultima_mensagem_remetente")
            if not remetente or remetente == "cliente":
                continue
            data = a.get("ultima_mensagem_data")
            data_dt = datetime.fromisoformat(data) if data else None
            if corte and (data_dt is None or data_dt > corte):
                continue
            fora.append(a)
        return fora

    def __call__(self, method, table, query="", payload=None):
        self.chamadas.append({"method": method, "table": table,
                              "query": query, "payload": payload})
        if self.falha_em == table:
            return 500, "erro interno"
        if table == "atendimentos":
            return 200, self._publico(query)
        if table == "remarketing_opt_out":
            return 200, self.opt_out
        if table == "bulk_campaigns" and method == "GET":
            return 200, self.campanhas
        if table == "bulk_campaigns" and method == "POST":
            self.posts.append(payload)
            return 201, [payload]
        return 200, []


def rodar(config, rest, **extra):
    rotina = {"id": "r1", "nome": "remarketing_diario", "config": config}
    ctx = {"rest": rest}
    ctx.update(extra)
    return w.handler_remarketing_diario(rotina, AGORA, ctx)


class TestPublico(unittest.TestCase):
    def test_consulta_usa_a_regra_do_plano_e_sem_sinal_mais(self):
        rest = FakeRest()
        rodar({}, rest)
        q = [c["query"] for c in rest.chamadas if c["table"] == "atendimentos"]
        self.assertEqual(len(q), 1)
        self.assertIn("ultima_mensagem_remetente=neq.cliente", q[0])
        self.assertIn("status=in.(aberto,em_andamento)", q[0])
        self.assertIn("ultima_mensagem_data=lte.", q[0])
        self.assertNotIn("+", q[0])
        self.assertIn("limit=", q[0])

    def test_publico_e_desdeduplicado_por_telefone(self):
        rest = FakeRest(atendimentos=[
            atend(telefone="5562911111111"),
            atend(telefone="5562911111111", nome="Outro atendimento"),
            atend(telefone="5562922222222"),
        ])
        r = rodar({"dry_run": False, "template": "Oi {{nome}}"}, rest)
        numeros = rest.posts[0]["numbers"]
        self.assertEqual(len(numeros), 2)
        self.assertEqual(r["enviados"], 2)


class TestCortesDeSeguranca(unittest.TestCase):
    def test_padrao_e_dry_run_nao_cria_campanha(self):
        rest = FakeRest(atendimentos=[atend()])
        r = rodar({"template": "Oi"}, rest)
        self.assertEqual(rest.posts, [])
        self.assertIn("dry_run", r["resumo"])
        self.assertEqual(r["contagem"], 1)

    def test_dry_run_false_cria_campanha_rodando_com_tipo_e_regra(self):
        rest = FakeRest(atendimentos=[atend(nome="Maria")])
        r = rodar({
            "dry_run": False,
            "template": "Olá {{nome}}, tudo bem?",
            "instancia": "STK-2",
            "intervalo": 90,
            "teto_diario": 10,
            "janela_horas": 24,
            "nao_rematar_dias": 7,
        }, rest)
        self.assertEqual(len(rest.posts), 1)
        c = rest.posts[0]
        self.assertEqual(c["status"], "running")
        self.assertEqual(c["tipo"], "remarketing")
        self.assertEqual(c["message"], "Olá {{nome}}, tudo bem?")
        self.assertEqual(c["instancia"], "STK-2")
        self.assertEqual(c["intervalo"], 90)
        self.assertEqual(c["numbers"], [{"nome": "Maria", "telefone": "5562999990000"}])
        regra = c["regra"]
        self.assertEqual(regra["janela_horas"], 24)
        self.assertEqual(regra["teto_diario"], 10)
        self.assertEqual(regra["nao_rematar_dias"], 7)
        self.assertEqual(regra["origem"], "publico_sem_resposta_24h")
        self.assertEqual(r["enviados"], 1)

    def test_opt_out_sempre_fora(self):
        rest = FakeRest(
            atendimentos=[atend(telefone="5562911111111"),
                          atend(telefone="5562922222222")],
            opt_out=[{"telefone": "(62) 91111-1111"}],   # formato torto: normaliza
        )
        r = rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertEqual([n["telefone"] for n in rest.posts[0]["numbers"]],
                         ["5562922222222"])
        self.assertEqual(r["ignorados_opt_out"], 1)

    def test_nao_remata_quem_recebeu_recentemente(self):
        recente = (AGORA - timedelta(days=2)).isoformat()
        rest = FakeRest(
            atendimentos=[atend(telefone="5562911111111"),
                          atend(telefone="5562922222222")],
            campanhas=[{"id": "c1", "created_at": recente,
                        "numbers": [{"nome": "", "telefone": "5562911111111"}]}],
        )
        rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertEqual([n["telefone"] for n in rest.posts[0]["numbers"]],
                         ["5562922222222"])

    def test_teto_diario_limita_o_lote(self):
        rest = FakeRest(atendimentos=[
            atend(telefone=f"55629{i:09d}") for i in range(30)
        ])
        r = rodar({"dry_run": False, "template": "Oi", "teto_diario": 10}, rest)
        self.assertEqual(len(rest.posts[0]["numbers"]), 10)
        self.assertEqual(r["enviados"], 10)
        self.assertEqual(r["cortados"], 20)

    def test_cadencia_bloqueia_segunda_campanha_no_mesmo_dia(self):
        ontem = (AGORA - timedelta(hours=3)).isoformat()
        rest = FakeRest(atendimentos=[atend()],
                        campanhas=[{"id": "c1", "created_at": ontem,
                                    "numbers": [{"nome": "", "telefone": "x"}]}])
        r = rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertEqual(rest.posts, [])
        self.assertIn("cadência", r["resumo"])

    def test_sem_template_nao_cria_nada(self):
        rest = FakeRest(atendimentos=[atend()])
        r = rodar({"dry_run": False, "template": "   "}, rest)
        self.assertEqual(rest.posts, [])
        self.assertIn("template", r["resumo"].lower())

    def test_publico_vazio_nao_cria_campanha(self):
        rest = FakeRest(atendimentos=[atend(horas=1)])   # ainda na janela
        r = rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertEqual(rest.posts, [])
        self.assertEqual(r["enviados"], 0)
        self.assertIn("vazio", r["resumo"])

    def test_falha_na_query_nao_lanca_e_nao_envia(self):
        rest = FakeRest(falha_em="atendimentos")
        r = rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertEqual(rest.posts, [])
        self.assertIn("falha", r["resumo"].lower())


class TestTemplateECadencia(unittest.TestCase):
    def test_variaveis_sao_as_mesmas_do_worker(self):
        # {{nome}}/{{telefone}} são resolvidas pelo próprio worker no envio;
        # aqui só garantimos que o template sobrevive intacto na campanha.
        rest = FakeRest(atendimentos=[atend()])
        rodar({"dry_run": False, "template": "Oi {{nome}}, falo da STK — {{telefone}}"}, rest)
        self.assertEqual(rest.posts[0]["message"],
                         "Oi {{nome}}, falo da STK — {{telefone}}")

    def test_regra_guarda_dry_run_para_auditoria(self):
        rest = FakeRest(atendimentos=[atend()])
        rodar({"dry_run": False, "template": "Oi"}, rest)
        self.assertIs(rest.posts[0]["regra"]["dry_run"], False)


if __name__ == "__main__":
    unittest.main()
