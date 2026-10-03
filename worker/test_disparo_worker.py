#!/usr/bin/env python3
"""Testes unitários do worker de disparo WAHA (stdlib unittest, sem rede)."""

import sys
import os
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import disparo_worker_waha as w


class TestNormalizacao(unittest.TestCase):
    def test_digits(self):
        self.assertEqual(w.normalizar_digits("(62) 99999-0000"), "62999990000")

    def test_chat_id_adiciona_55(self):
        self.assertEqual(w.formatar_chat_id("(62) 99999-0000"), "5562999990000@c.us")

    def test_chat_id_ja_tem_55(self):
        self.assertEqual(w.formatar_chat_id("5562999990000"), "5562999990000@c.us")


class TestVariaveis(unittest.TestCase):
    def test_substitui_nome_e_telefone(self):
        txt = w.substituir_variaveis("Olá {{nome}}, seu número é {{telefone}}", "Maria", "62999990000")
        self.assertEqual(txt, "Olá Maria, seu número é 62999990000")

    def test_nome_vazio_nao_quebra(self):
        txt = w.substituir_variaveis("Olá {{nome}}!", "", "")
        self.assertEqual(txt, "Olá !")


class TestPassos(unittest.TestCase):
    def test_fluxo_mensagens_vence_message(self):
        campaign = {
            "message": "antiga",
            "fluxo_mensagens": [
                {"type": "text", "content": "Passo 1"},
                {"type": "image", "url": "https://x/img.jpg", "mimetype": "image/jpeg"},
            ],
        }
        passos = w.montar_passos(campaign)
        self.assertEqual([p["type"] for p in passos], ["text", "image"])

    def test_legado_imagem_url_primeiro_depois_texto(self):
        campaign = {"message": "Promoção!", "imagem_url": "https://x/img.jpg"}
        passos = w.montar_passos(campaign)
        self.assertEqual([p["type"] for p in passos], ["image", "text"])

    def test_sem_nada_retorna_vazio(self):
        self.assertEqual(w.montar_passos({"message": ""}), [])


class TestPayload(unittest.TestCase):
    def test_texto_com_variaveis(self):
        endpoint, payload = w.passo_payload(
            {"type": "text", "content": "Oi {{nome}}"},
            "5562999990000@c.us", "STK-1", "João", "5562999990000",
        )
        self.assertEqual(endpoint, "sendText")
        self.assertEqual(payload["text"], "Oi João")
        self.assertEqual(payload["session"], "STK-1")

    def test_imagem_por_url(self):
        endpoint, payload = w.passo_payload(
            {"type": "image", "url": "https://x/i.jpg", "mimetype": "image/jpeg"},
            "5562999990000@c.us", "STK-3", "", "",
        )
        self.assertEqual(endpoint, "sendImage")
        self.assertEqual(payload["file"]["url"], "https://x/i.jpg")


class TestBase64Prefisxado(unittest.TestCase):
    """Bug 03/10: a tela grava o passo como 'data:image/jpeg;base64,...' e a
    WAHA exige base64 PURO — com o prefixo a decodificação sai corrompida
    (prova: fileLength 432548 com prefixo vs 432533 limpo) e o WhatsApp
    renderiza a imagem como arquivo de 422 KB."""

    IMAGEM = {"type": "image",
              "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ",
              "mimetype": "image/jpeg"}

    def test_remove_prefixo_data_uri(self):
        endpoint, payload = w.passo_payload(
            self.IMAGEM, "5562999990000@c.us", "STK-3", "", "")
        self.assertEqual(endpoint, "sendImage")
        self.assertEqual(payload["file"]["data"], "/9j/4AAQSkZJRgABAQ")
        self.assertEqual(payload["file"]["mimetype"], "image/jpeg")

    def test_prefixo_de_qualquer_mime_tambem_cai(self):
        passo = {"type": "image",
                 "base64": "data:application/octet-stream;base64,AAAABBBB",
                 "mimetype": "image/png"}
        _, payload = w.passo_payload(
            passo, "5562999990000@c.us", "STK-3", "", "")
        self.assertEqual(payload["file"]["data"], "AAAABBBB")

    def test_base64_puro_passa_intacto(self):
        passo = {"type": "image", "base64": "/9j/4AAQSkZJRgABAQ",
                 "mimetype": "image/jpeg"}
        _, payload = w.passo_payload(
            passo, "5562999990000@c.us", "STK-3", "", "")
        self.assertEqual(payload["file"]["data"], "/9j/4AAQSkZJRgABAQ")


class TestContatoValido(unittest.TestCase):
    """Bug 03/10: a lista de números vinha com a instância no topo
    ('STK-3' → chatId '553@c.us' → ERRO sendText)."""

    def test_instancia_nao_e_contato(self):
        self.assertFalse(w.eh_contato("STK-3"))

    def test_telefone_internacional(self):
        self.assertTrue(w.eh_contato("556282735286"))

    def test_telefone_formatado(self):
        self.assertTrue(w.eh_contato("(62) 99999-0000"))

    def test_curto_e_vazio(self):
        self.assertFalse(w.eh_contato("553"))
        self.assertFalse(w.eh_contato(""))
        self.assertFalse(w.eh_contato(None))

    def test_contato_dict_sem_telefone(self):
        self.assertFalse(w.eh_contato(""))


class TestProcessarPulaContatoInvalido(unittest.TestCase):
    """processar_campanha não pode nem chamar a WAHA para lixo na lista."""

    def test_nao_envia_e_conta_como_falha(self):
        campanha = {
            "id": "c1", "name": "teste", "status": "running",
            "numbers": ["STK-3"], "message": "oi", "instancia": "STK-3",
            "sent": 0, "failed": 0, "intervalo": 1, "intervalo_passos": 1,
        }
        with mock.patch.object(w, "reclamar_campanha", return_value=True), \
             mock.patch.object(w, "status_atual", return_value="running"), \
             mock.patch.object(w, "supabase_rest", return_value=(200, [])), \
             mock.patch.object(w, "resolver_nome", return_value=""), \
             mock.patch.object(w, "atualizar_contadores") as contadores, \
             mock.patch.object(w, "waha_send") as envio:
            w.processar_campanha(campanha)

        envio.assert_not_called()
        # a retomada usa sent+failed: o item inválido precisa contar como falha
        self.assertEqual(contadores.call_args[0][1:], (0, 1))


class TestRetomada(unittest.TestCase):
    def test_offset_soma_sent_failed(self):
        self.assertEqual(w.offset_retomada({"sent": 3, "failed": 2}), 5)

    def test_offset_zerado(self):
        self.assertEqual(w.offset_retomada({}), 0)


class TestJanela(unittest.TestCase):
    """F0.2 — corte do agendador entra na query string do PostgREST."""

    def test_corte_nao_tem_sinal_mais(self):
        # '+' em query string vira espaço no urllib → PostgREST 400 (bug 26/09)
        from datetime import datetime, timezone
        agora = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)
        h, corte = w._janela(agora, 24)
        self.assertEqual(h, 24.0)
        self.assertNotIn("+", corte)
        self.assertTrue(corte.endswith("Z"))
        self.assertTrue(corte.startswith("2026-09-25"))

    def test_horas_invalido_vira_padrao_24(self):
        from datetime import datetime, timezone
        agora = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)
        for valor in (None, 0, -3, "abc"):
            h, _ = w._janela(agora, valor)
            self.assertEqual(h, 24.0)


if __name__ == "__main__":
    unittest.main()
