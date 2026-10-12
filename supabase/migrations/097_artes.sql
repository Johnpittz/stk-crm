-- ============================================================
-- Migration 097: PEDIDO 3 (11/10) — ARTES PERSONALIZADAS (MARKETING)
--
-- Galeria das artes geradas com IA (Gemini / Nano Banana):
-- o "grande prompt" guiado vira imagem, que vai para o bucket
-- "media" e aparece na tela Marketing > Criar Artes, com botão
-- Disparar (alimenta a fila de disparo com a imagem pronta).
--
-- Executar no SQL Editor do Supabase (projeto STK). Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  -- o "grande prompt" montado pela tela (rastro de como a arte nasceu)
  prompt TEXT NOT NULL,
  -- feed_insta | story | facebook | banner
  formato TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'gerando',
  imagem_url TEXT,
  erro TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artes_created_at ON public.artes (created_at DESC);

DROP TRIGGER IF EXISTS artes_touch ON public.artes;
CREATE TRIGGER artes_touch
  BEFORE UPDATE ON public.artes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: mesmo padrão das tabelas do projeto (perfil autenticado lê e edita)
ALTER TABLE public.artes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.artes;
CREATE POLICY "leitura autenticada"
  ON public.artes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.artes;
CREATE POLICY "escrita autenticada"
  ON public.artes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.artes TO authenticated;
