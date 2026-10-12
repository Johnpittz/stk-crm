-- ============================================================
-- Migration 098: MELHORIA 12/10 — IMAGENS DE REFERÊNCIA DAS ARTES
--
-- No estilo AUTOIMAGEM: o admin sobe logo/foto/cenário uma vez;
-- cada imagem vira um marker {{nome_slug}} citável no campo
-- "Observações" do assistente de artes. A geração manda as imagens
-- juntas pro Gemini (posicionadas pelo marker ou na frente).
-- Executar no SQL Editor do SUPABASE PROJETO STK. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artes_referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  marker TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artes_referencias_marker
  ON public.artes_referencias (marker);

DROP TRIGGER IF EXISTS artes_referencias_touch ON public.artes_referencias;
CREATE TRIGGER artes_referencias_touch
  BEFORE UPDATE ON public.artes_referencias
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.artes_referencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.artes_referencias;
CREATE POLICY "leitura autenticada"
  ON public.artes_referencias FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.artes_referencias;
CREATE POLICY "escrita autenticada"
  ON public.artes_referencias FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.artes_referencias TO authenticated;
