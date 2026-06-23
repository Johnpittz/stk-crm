-- ============================================================
-- GRUPOS ECONOMICOS
-- Agrupa clientes que pertencem a mesma matriz
-- ============================================================

-- 1. Tabela de grupos econômicos
CREATE TABLE IF NOT EXISTS public.grupos_economicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj_matriz TEXT,
  qtd_lojas INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grupos_economicos_nome ON public.grupos_economicos(nome);

-- 2. RLS
ALTER TABLE public.grupos_economicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_grupos" ON public.grupos_economicos;
CREATE POLICY "authenticated_select_grupos" ON public.grupos_economicos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_grupos" ON public.grupos_economicos;
CREATE POLICY "service_role_all_grupos" ON public.grupos_economicos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.grupos_economicos TO authenticated;
GRANT ALL ON public.grupos_economicos TO service_role;

-- 3. Adicionar coluna grupo_economico_id na tabela clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo_economico_id UUID
  REFERENCES public.grupos_economicos(id);

CREATE INDEX IF NOT EXISTS idx_clientes_grupo_economico ON public.clientes(grupo_economico_id);