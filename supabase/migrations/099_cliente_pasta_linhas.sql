-- ============================================================
-- Migration 099: PASTA DO CLIENTE — 4 NOVAS LINHAS DE NEGÓCIO
--
-- ELETROPOSTO, SIGMA SOLAR (monitoramento de usinas), BESS e
-- GESTÃO DE FATURA como abas da pasta do cliente (GD e RECIEE já
-- existem). Uma linha genérica com JSONB cobre as 4: as abas
-- montam os campos a partir do catálogo do código (lib
-- `lib/clientes/linhas.ts`) e gravam aqui.
-- Executar no SQL Editor do SUPABASE PROJETO STK. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cliente_pasta_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  linha TEXT NOT NULL
    CHECK (linha IN ('eletroposto', 'sigma', 'bess', 'gestao_fatura')),
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_pasta_linhas_cliente
  ON public.cliente_pasta_linhas (cliente_id, linha);

DROP TRIGGER IF EXISTS cliente_pasta_linhas_touch ON public.cliente_pasta_linhas;
CREATE TRIGGER cliente_pasta_linhas_touch
  BEFORE UPDATE ON public.cliente_pasta_linhas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.cliente_pasta_linhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.cliente_pasta_linhas;
CREATE POLICY "leitura autenticada"
  ON public.cliente_pasta_linhas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.cliente_pasta_linhas;
CREATE POLICY "escrita autenticada"
  ON public.cliente_pasta_linhas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.cliente_pasta_linhas TO authenticated;
