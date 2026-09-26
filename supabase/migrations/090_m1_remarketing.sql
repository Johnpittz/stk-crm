-- ============================================================
-- Migration 090: M1 — Disparo canônico + remarketing
-- (docs/plano-acao-modulos.md, Fase 2)
--
-- 1) bulk_campaigns ganha TIPO (avulso x remarketing) e REGRA (auditoria de
--    qual recorte gerou a lista — exigência do item 3 do M1).
-- 2) remarketing_opt_out — quem pediu para parar sai do público para sempre
--    (guarda do item 5; o chatbot grava aqui quando detecta o pedido).
-- 3) Seed da rotina "remarketing_diario" — gatilho diário no worker (item 4).
--    NÃO ENVIA NADA POR PADRÃO: dry_run=true E template preenchido é a dupla
--    trava; para valer é preciso editar a linha E religar o worker com
--    AGENDADOR_DRY_RUN=0.
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- 1) tipo + regra em bulk_campaigns ------------------------------------------
ALTER TABLE public.bulk_campaigns
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'avulso';

-- CHECK idempotente (nome automático varia se a tabela já tiver outra)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.bulk_campaigns'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.bulk_campaigns DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$$;

ALTER TABLE public.bulk_campaigns
  ADD CONSTRAINT bulk_campaigns_tipo_check
  CHECK (tipo IN ('avulso', 'remarketing'));

-- Auditoria: qual regra gerou a lista (janela, teto, recorte, quem criou).
ALTER TABLE public.bulk_campaigns
  ADD COLUMN IF NOT EXISTS regra JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bulk_campaigns.tipo IS
  'avulso = digitacao manual/planilha | remarketing = publico sem resposta 24h';
COMMENT ON COLUMN public.bulk_campaigns.regra IS
  'Auditoria do recorte: {origem, janela_horas, teto_diario, nao_rematar_dias, dry_run, criado_por}';

CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_tipo_criada
  ON public.bulk_campaigns (tipo, created_at DESC);

-- 2) opt-out ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remarketing_opt_out (
  telefone TEXT PRIMARY KEY,          -- só dígitos, formato canonico
  motivo TEXT NOT NULL DEFAULT 'pedido_do_cliente',
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.remarketing_opt_out IS
  'Recusa de mensagem de marketing (M1). Sai de TODO publico de remarketing.';

ALTER TABLE public.remarketing_opt_out ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_opt_out" ON public.remarketing_opt_out;
CREATE POLICY "authenticated_read_opt_out" ON public.remarketing_opt_out
  FOR SELECT TO authenticated USING (true);

-- service_role (worker + API) escreve sem política: role privilegiada.

-- 3) seed da rotina diária --------------------------------------------------
INSERT INTO public.worker_rotinas (nome, descricao, intervalo_horas, config, proxima_execucao) VALUES
  ('remarketing_diario',
   'M1 — cria e roda a campanha de remarketing (publico: nos falamos por ultimo, 24h sem resposta)',
   24,
   '{
     "dry_run": true,
     "janela_horas": 24,
     "teto_diario": 20,
     "nao_rematar_dias": 7,
     "intervalo_horas_min": 24,
     "intervalo": 60,
     "intervalo_passos": 10,
     "delay_inicial": 60,
     "instancia": "STK-3",
     "template": "Ola {{nome}}, tudo bem? Aqui e a equipe STK. Ficou uma conversa nossa em aberto — posso te ajudar a continuar por aqui? 😊"
   }'::jsonb,
   now() + interval '1 day')
ON CONFLICT (nome) DO NOTHING;
