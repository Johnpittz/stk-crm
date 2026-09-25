-- ============================================
-- Migration 086: rename de rótulo ROMA_2 -> STK-3
-- docs/plano-migracao-waha.md Fase 8 (D1) — executar SOMENTE no cutover,
-- junto com a troca Evolution -> WAHA (enquanto a Evolution estiver ativa,
-- o webhook antigo ainda chega com instance='ROMA_2' e a busca de atendimento
-- por telefone+instancia deixaria de casar => atendimentos duplicados).
-- É mudança de etiqueta de coluna de texto — NENHUM conteúdo de conversa é tocado.
-- ============================================

-- 1) atendimentos
UPDATE public.atendimentos SET instancia = 'STK-3' WHERE instancia = 'ROMA_2';

-- 2) bulk_campaigns (valores + default da migration 077)
UPDATE public.bulk_campaigns SET instancia = 'STK-3' WHERE instancia = 'ROMA_2';
ALTER TABLE public.bulk_campaigns ALTER COLUMN instancia SET DEFAULT 'STK-3';

-- 3) chatbot_flows + chatbot_sessions
UPDATE public.chatbot_flows SET instancia = 'STK-3' WHERE instancia = 'ROMA_2';
UPDATE public.chatbot_sessions SET instancia = 'STK-3' WHERE instancia = 'ROMA_2';

-- 4) profiles.whatsapp_instance (se a coluna existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'whatsapp_instance'
  ) THEN
    UPDATE public.profiles SET whatsapp_instance = 'STK-3' WHERE whatsapp_instance = 'ROMA_2';
  END IF;
END $$;
