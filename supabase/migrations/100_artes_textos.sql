-- ============================================================
-- Migration 100: ITEM 3 (16/10) — TEXTOS CADASTRADOS DAS ARTES
--
-- O João quer gravar como CADASTRO o número da empresa e as
-- opções de texto ("orçamento grátis", "atendimento 24h"...)
-- para usar na geração de artes, escolhendo ONDE colocar
-- (canto superior, rodapé...) na hora de gerar.
-- Executar no SQL Editor do SUPABASE PROJETO STK. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artes_textos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'numero' = WhatsApp/número da empresa (só um por vez);
  -- 'opcao'  = frases curtas que o vendedor marca na geração
  tipo TEXT NOT NULL CHECK (tipo IN ('numero', 'opcao')),
  texto TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artes_textos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.artes_textos;
CREATE POLICY "leitura autenticada"
  ON public.artes_textos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.artes_textos;
CREATE POLICY "escrita autenticada"
  ON public.artes_textos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.artes_textos TO authenticated;
