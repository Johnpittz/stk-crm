-- ============================================================
-- ORIGENS DE LEAD
-- Permite rastrear de onde veio cada lead/tarefa
-- ============================================================

-- 1. Tabela de origens configuráveis
CREATE TABLE IF NOT EXISTS public.origens_lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '📋',
  cor TEXT DEFAULT 'bg-slate-100 text-slate-700',
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.origens_lead ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_origens" ON public.origens_lead;
CREATE POLICY "authenticated_select_origens" ON public.origens_lead
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_origens" ON public.origens_lead;
CREATE POLICY "service_role_all_origens" ON public.origens_lead
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.origens_lead TO authenticated;
GRANT ALL ON public.origens_lead TO service_role;

-- 2. Inserir origens padrão
INSERT INTO public.origens_lead (slug, nome, icone, cor) VALUES
  ('prospeccao_b2b', 'Prospecção B2B', '🔍', 'bg-emerald-100 text-emerald-700'),
  ('whatsapp', 'WhatsApp', '💬', 'bg-green-100 text-green-700'),
  ('indicacao', 'Indicação', '🤝', 'bg-purple-100 text-purple-700'),
  ('site', 'Site/Formulário', '🌐', 'bg-blue-100 text-blue-700'),
  ('pixel', 'Pixel/Meta', '📊', 'bg-orange-100 text-orange-700'),
  ('api', 'API/Integração', '🔗', 'bg-cyan-100 text-cyan-700'),
  ('importacao', 'Importação', '📁', 'bg-slate-100 text-slate-700'),
  ('manual', 'Manual', '✋', 'bg-slate-100 text-slate-500'),
  ('evento', 'Evento/Feira', '🎪', 'bg-amber-100 text-amber-700'),
  ('indicação', 'Indicação', '🤝', 'bg-purple-100 text-purple-700')
ON CONFLICT (slug) DO NOTHING;

-- 3. Adicionar coluna origem_lead na tabela tarefas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS origem_lead TEXT;