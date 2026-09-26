-- ============================================================
-- Migration 088: worker_rotinas — agenda do agendador único (F0.2
-- de docs/plano-acao-modulos.md)
--
-- Uma rotina = uma linha. Ligar/desligar/intervalo não exige deploy:
-- é editar a linha. O worker (disparo_worker_waha.py) varre esta tabela
-- a cada DISPARO_AGENDADOR_POLL segundos e roda o que estiver vencido.
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.worker_rotinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL DEFAULT '',
  ativa BOOLEAN NOT NULL DEFAULT true,
  intervalo_horas NUMERIC NOT NULL DEFAULT 24,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ DEFAULT now(),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_rotinas_ativa
  ON public.worker_rotinas (ativa, proxima_execucao);

-- RLS: quem escreve é o worker (service_role); ninguém edita pela UI nesta fase.
ALTER TABLE public.worker_rotinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_worker_rotinas" ON public.worker_rotinas;
CREATE POLICY "service_role_all_worker_rotinas" ON public.worker_rotinas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_worker_rotinas" ON public.worker_rotinas;
CREATE POLICY "authenticated_read_worker_rotinas" ON public.worker_rotinas
  FOR SELECT TO authenticated USING (true);

-- Seed das rotinas de preparação da Fase 0 (somente contam/imprimem).
-- config: janelas em horas, editáveis por UPDATE.
INSERT INTO public.worker_rotinas (nome, descricao, intervalo_horas, config, proxima_execucao) VALUES
  ('preparacao_remarketing',
   'C1 — conta conversas >24h com o cliente como último falante (somente leitura)',
   24, '{"janela_horas": 24}'::jsonb, now()),
  ('preparacao_alerta_kanban',
   'C2 — conta oportunidades sem mudança de etapa >72h (somente leitura)',
   24, '{"parada_horas": 72}'::jsonb, now())
ON CONFLICT (nome) DO NOTHING;
