#!/usr/bin/env python3
"""Testes unitários do worker de disparo WAHA (stdlib unittest, sem rede)."""

import sys
import os
import unittest

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


class TestRetomada(unittest.TestCase):
    def test_offset_soma_sent_failed(self):
        self.assertEqual(w.offset_retomada({"sent": 3, "failed": 2}), 5)

    def test_offset_zerado(self):
        self.assertEqual(w.offset_retomada({}), 0)


if __name__ == "__main__":
    unittest.main()
