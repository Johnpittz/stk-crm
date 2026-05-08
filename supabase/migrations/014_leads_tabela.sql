-- Migration: Tabela de Leads Separada
-- Cria pipeline de leads antes de virar cliente

-- ============================================================
-- 1. Função auxiliar is_gerencia (garante que existe)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_gerencia()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND cargo IN ('gerente_comercial', 'diretor', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Tipo enum para status do lead
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.status_lead AS ENUM ('novo', 'em_atendimento', 'convertido', 'descartado');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- 3. Tabela de Leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados da empresa
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado CHAR(2),
  cep TEXT,

  -- Dados comerciais
  cnae_principal TEXT,
  cnae_descricao TEXT,
  porte TEXT,
  capital_social TEXT,
  situacao_cadastral TEXT,

  -- Origem
  origem TEXT NOT NULL DEFAULT 'prospeccao_b2b',
  canal_origem_id UUID REFERENCES public.canais(id),
  dados_brutos JSONB DEFAULT '{}',

  -- Pipeline
  status public.status_lead NOT NULL DEFAULT 'novo',
  vendedor_id UUID REFERENCES public.profiles(id),
  importado_por UUID NOT NULL REFERENCES auth.users(id),
  data_atribuicao TIMESTAMPTZ,
  observacoes TEXT,

  -- Conversão
  cliente_id UUID REFERENCES public.clientes(id),
  data_conversao TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON public.leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_importado_por ON public.leads(importado_por);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_cnpj ON public.leads(cnpj);

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestores_veem_todos_leads" ON public.leads;
CREATE POLICY "gestores_veem_todos_leads" ON public.leads
  FOR ALL TO authenticated
  USING (is_gerencia())
  WITH CHECK (is_gerencia());

DROP POLICY IF EXISTS "vendedores_veem_seus_leads" ON public.leads;
CREATE POLICY "vendedores_veem_seus_leads" ON public.leads
  FOR ALL TO authenticated
  USING (vendedor_id = auth.uid())
  WITH CHECK (vendedor_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all_leads" ON public.leads;
CREATE POLICY "service_role_all_leads" ON public.leads
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
GRANT USAGE ON TYPE public.status_lead TO authenticated;
GRANT USAGE ON TYPE public.status_lead TO service_role;

-- ============================================================
-- 5. Trigger: notificar vendedor quando lead é atribuído
-- ============================================================

CREATE OR REPLACE FUNCTION public.notificar_atribuicao_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendedor_id IS NOT NULL AND (OLD.vendedor_id IS NULL OR OLD.vendedor_id != NEW.vendedor_id) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (
      NEW.vendedor_id,
      'tarefa_nova',
      'Novo lead atribuído a você',
      COALESCE(NEW.razao_social, 'Empresa') || ' foi atribuída para sua prospecção.',
      jsonb_build_object('lead_id', NEW.id, 'cnpj', NEW.cnpj)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notificar_atribuicao_lead ON public.leads;
CREATE TRIGGER trg_notificar_atribuicao_lead
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_atribuicao_lead();

-- ============================================================
-- 6. Trigger: atualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_leads()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_updated_at_leads ON public.leads;
CREATE TRIGGER trg_atualizar_updated_at_leads
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_updated_at_leads();
