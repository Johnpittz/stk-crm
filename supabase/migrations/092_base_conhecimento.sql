-- ============================================================
-- Migration 092: base_conhecimento — Fase 4 / M2 de docs/plano-acao-modulos.md
--
-- "Base de conhecimento editável no painel": o que a IA do atendimento pode
-- afirmar sobre a STK. Sem linhas ativas aqui, o prompt sai com a instrução
-- de NÃO responder e a IA emite [[ENCAMINHAR]] → o cliente cai no vendedor
-- (guardrail do M2). É a única fonte de verdade do chatbot.
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.base_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL DEFAULT 'Geral',
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  -- opção prática de preencher no form (separado por vírgula) que vira array
  palavras_chave TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_conhecimento_ativo_categoria
  ON public.base_conhecimento (ativo, categoria);

-- Sempre que o registro mudar, o updated_at acompanha
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS base_conhecimento_touch ON public.base_conhecimento;
CREATE TRIGGER base_conhecimento_touch
  BEFORE UPDATE ON public.base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: mesmo padrão das tabelas do projeto (perfil autenticado lê e edita)
ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.base_conhecimento;
CREATE POLICY "leitura autenticada"
  ON public.base_conhecimento FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "escrita autenticada" ON public.base_conhecimento;
CREATE POLICY "escrita autenticada"
  ON public.base_conhecimento FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.base_conhecimento TO authenticated;
