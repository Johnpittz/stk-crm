-- ============================================
-- MIGRATION: Ligação entre Campanhas, Disparos e Promoções
-- ============================================

-- Adicionar campanha_id e promocao_id ao bulk_campaigns
ALTER TABLE public.bulk_campaigns 
ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES public.campanhas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promocao_id UUID REFERENCES public.promocoes_marketing(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_campanha_id ON public.bulk_campaigns(campanha_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_promocao_id ON public.bulk_campaigns(promocao_id);

-- Adicionar coluna de nota do lead na tabela de leads (para observações)
ALTER TABLE public.leads_marketing 
ADD COLUMN IF NOT EXISTS origem_campanha_id UUID REFERENCES public.campanhas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origem_disparo_id UUID REFERENCES public.bulk_campaigns(id) ON DELETE SET NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Ligação entre módulos criada!';
  RAISE NOTICE '  ✓ bulk_campaigns → campanhas (campanha_id)';
  RAISE NOTICE '  ✓ bulk_campaigns → promocoes (promocao_id)';
  RAISE NOTICE '  ✓ leads_marketing → campanhas (origem_campanha_id)';
  RAISE NOTICE '  ✓ leads_marketing → bulk_campaigns (origem_disparo_id)';
END $$;