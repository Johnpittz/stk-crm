-- ============================================================
-- Migration 089: índices da Fase 1 (C1/C2 de docs/plano-acao-modulos.md)
--
-- 1) C1 "sem resposta": a lista de atendimentos filtra/conta por
--    (ultima_mensagem_remetente, ultima_mensagem_data) só em conversas vivas.
--    O remarketing do M1 (Fase 2) usa a MESMA régua e o mesmo índice.
-- 2) C2 "kanban parado": o worker lê o último alerta por
--    (tipo, created_at) para não avisar duas vezes a mesma oportunidade.
-- 3) Badge da coluna do funil: conta oportunidades por (etapa, updated_at).
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_atendimentos_sem_resposta
  ON public.atendimentos (ultima_mensagem_remetente, ultima_mensagem_data DESC)
  WHERE status IN ('aberto', 'em_andamento');

CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo_criada
  ON public.notificacoes (tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa_updated
  ON public.oportunidades (etapa, updated_at DESC);
