-- ============================================================
-- Migration 093: propostas — o documento de proposta (Fase 6 / C4)
--
-- Antes desta fase não existia "proposta" como entidade: só a oportunidade
-- (valores/etapa) e o cadastro do cliente. Agora:
--   • a rota POST /api/propostas gera o PDF (pdf-lib),
--   • salva no bucket privado "propostas",
--   • grava AQUI o registro (snapshot do conteúdo em `dados`).
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- vínculos (sem FK de profiles, mesmo padrão da fila AXS)
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  oportunidade_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  vendedor_id UUID,
  gerado_por UUID,

  -- documento
  numero TEXT NOT NULL,                 -- PROP-AAAAMMDD-XXXX
  titulo TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,   -- snapshot do conteúdo do PDF
  arquivo_path TEXT NOT NULL,           -- caminho estável no Storage
  arquivo_nome TEXT NOT NULL,           -- nome exibido no download
  tamanho_bytes INTEGER,
  data_emissao DATE NOT NULL,
  validade DATE NOT NULL,               -- emissão + 30 dias (D8 do plano)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UMA proposta por oportunidade: gerar de novo substitui (upsert por esta
-- chave) em vez de criar versões duplicadas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_propostas_oportunidade
  ON public.propostas (oportunidade_id)
  WHERE oportunidade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_cliente
  ON public.propostas (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_propostas_vendedor
  ON public.propostas (vendedor_id, created_at DESC);

-- updated_at automático (mesmo padrão das migrations 084/091)
CREATE OR REPLACE FUNCTION public.update_propostas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_propostas_updated_at ON public.propostas;
CREATE TRIGGER trigger_propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_propostas_updated_at();

-- RLS: a rota /api/propostas usa a service role (le e grava) e faz a checagem
-- de dono/cargo no código. Aqui garantimos que o CLIENTE do navegador só
-- enxergue as próprias (a tabela tem CPF/CNPJ no snapshot `dados`).
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_propostas" ON public.propostas;
CREATE POLICY "service_role_all_propostas" ON public.propostas
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vendedor_ve_propostas_proprias" ON public.propostas;
CREATE POLICY "vendedor_ve_propostas_proprias" ON public.propostas
  FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid());

DROP POLICY IF EXISTS "gestores_veem_todas_propostas" ON public.propostas;
CREATE POLICY "gestores_veem_todas_propostas" ON public.propostas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.cargo IN ('diretor', 'admin', 'gerente_comercial')
    )
  );

-- ------------------------------------------------------------
-- Bucket PRIVADO dos PDFs
-- Sem policy de leitura para `authenticated` de propósito: os arquivos só
-- saem de lá pela rota GET /api/propostas/[id]/arquivo, que já checa dono ou
-- gestor antes de devolver. (Contém CPF/CNPJ.)
-- A rota cria o bucket sozinha se ele faltar, mas isto aqui é o caminho
-- oficial — rode esta migration antes de usar o botão.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'propostas',
  'propostas',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;
