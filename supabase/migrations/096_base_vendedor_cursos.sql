-- ============================================================
-- Migration 096: PEDIDO 2 (11/10) — BASE DE CONHECIMENTO DO VENDEDOR
--
-- 1) base_conhecimento ganha DONO: vendedor_id NULL = entrada global
--    (comportamento atual, usada pela IA em qualquer conversa);
--    com UUID = base de um vendedor, usada pela IA somando às globais
--    nas conversas dele (decisão do João em 11/10).
-- 2) base_cursos: cursos do SINERGIA que aparecem como botão/link na
--    tela "Minha Base" do vendedor (vendedor_id NULL = para todos).
--
-- Executar no SQL Editor do Supabase (projeto nizreygwaqqojwrorpqo).
-- Idempotente.
-- ============================================================

-- 1. Dono da entrada de conhecimento -------------------------
ALTER TABLE public.base_conhecimento
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_base_conhecimento_vendedor
  ON public.base_conhecimento (vendedor_id);

-- 2. Cursos do SINERGIA --------------------------------------
CREATE TABLE IF NOT EXISTS public.base_cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  descricao TEXT,
  -- NULL = curso visível a todos os vendedores
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_cursos_ativo ON public.base_cursos (ativo);

-- updated_at acompanha (reusa a função da migration 092)
DROP TRIGGER IF EXISTS base_cursos_touch ON public.base_cursos;
CREATE TRIGGER base_cursos_touch
  BEFORE UPDATE ON public.base_cursos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: mesmo padrão do projeto (perfil autenticado lê e edita)
ALTER TABLE public.base_cursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.base_cursos;
CREATE POLICY "leitura autenticada"
  ON public.base_cursos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.base_cursos;
CREATE POLICY "escrita autenticada"
  ON public.base_cursos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.base_cursos TO authenticated;
