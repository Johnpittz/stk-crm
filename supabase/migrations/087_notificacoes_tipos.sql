-- ============================================================
-- Migration 087: notificacoes — libera os tipos que o código
-- realmente emite (F0.1 de docs/plano-acao-modulos.md)
--
-- Problema: o CHECK da migration 009 só aceitava
--   atendimento_novo | atendimento_mensagem | tarefa_nova | transbordo | meta_alcancada
-- mas o chatbot insere 'chatbot' e o webhook Millennium insere
-- 'meta_atingida' — o PostgREST recusava o insert e o sino ficava mudo.
-- (user_id NOT NULL é mantido: lib/notificacoes.ts resolve a audiência.)
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- 1) Derruba QUALQUER check constraint da coluna tipo (nome automático varia)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.notificacoes'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.notificacoes DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'constraint de tipo removida: %', c.conname;
  END LOOP;
END
$$;

-- 2) Recria com a lista completa (cobre também os tipos da Fase 1/2 do plano)
ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_tipo_check CHECK (tipo IN (
    'atendimento_novo',
    'atendimento_mensagem',
    'tarefa_nova',
    'transbordo',
    'meta_alcancada',
    'chatbot',
    'meta_atingida',
    'kanban_parado',
    'remarketing'
  ));

-- 3) Índice composto para o sino (lista do usuário: não lidas primeiro)
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida
  ON public.notificacoes (user_id, lida, created_at DESC);
