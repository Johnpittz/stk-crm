-- ============================================================
-- Migration 091: fila_propostas_axs — Fase 3 / C3 de docs/plano-acao-modulos.md
--
-- "Cadastrar proposta no CRM → criar na AXS": o form não dispara mais na
-- hora. Ele ENFILEIRA; o worker (worker/fila_axs.py, rodando no mesmo
-- processo do disparo) envia para POST /api/axs/send com retry, consulta o
-- job e só então marca `criada`. O que antes falhava em silêncio (502 da VPS
-- sem rastro) agora aparece na tela /fila-axs com botão "tentar de novo".
--
-- Executar no SQL Editor do Supabase. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fila_propostas_axs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  -- vínculo opcional com o funil (o enqueue resolve sozinho a última
  -- oportunidade aberta do cliente; sem oportunidade = null e não há
  -- retroalimentação)
  oportunidade_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  -- sem FK com profiles: o mesmo padrão de axs_propostas.vendedor_id
  vendedor_id UUID,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- máquina de estados: pendente -> enviando -> criada | erro | manual
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INT NOT NULL DEFAULT 0,
  max_tentativas INT NOT NULL DEFAULT 6,
  job_id TEXT,
  axs_card_id TEXT,
  erro TEXT,
  origem TEXT NOT NULL DEFAULT 'crm',     -- crm = form | manual = botão da fila

  proxima_tentativa TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_tentativa_em TIMESTAMPTZ,
  criada_em TIMESTAMPTZ,                  -- quando confirmada na AXS
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fila_propostas_axs_status_check
    CHECK (status IN ('pendente', 'enviando', 'criada', 'erro', 'manual'))
);

-- Varredura do worker: "o que está vencido nesta janela"
CREATE INDEX IF NOT EXISTS idx_fila_propostas_axs_status
  ON public.fila_propostas_axs (status, proxima_tentativa);

CREATE INDEX IF NOT EXISTS idx_fila_propostas_axs_cliente
  ON public.fila_propostas_axs (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fila_propostas_axs_vendedor
  ON public.fila_propostas_axs (vendedor_id, created_at DESC);

-- Só um item pendente por cliente (evita duas propostas para o mesmo cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_propostas_axs_pendente_cliente
  ON public.fila_propostas_axs (cliente_id)
  WHERE status IN ('pendente', 'enviando');

-- updated_at automático (mesmo padrão da migration 084)
CREATE OR REPLACE FUNCTION public.update_fila_propostas_axs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fila_propostas_axs_updated_at ON public.fila_propostas_axs;
CREATE TRIGGER trigger_fila_propostas_axs_updated_at
  BEFORE UPDATE ON public.fila_propostas_axs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fila_propostas_axs_updated_at();

-- RLS: a rota /api/axs/fila usa a service role (le/grava) e faz a checagem
-- de dono/cargo no código; o cliente do navegador não toca nesta tabela.
ALTER TABLE public.fila_propostas_axs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_fila_propostas_axs" ON public.fila_propostas_axs;
CREATE POLICY "service_role_all_fila_propostas_axs" ON public.fila_propostas_axs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Lê direto (a tela pode cruzar a fila com o cliente sem passar pela rota)
DROP POLICY IF EXISTS "authenticated_read_fila_propostas_axs" ON public.fila_propostas_axs;
CREATE POLICY "authenticated_read_fila_propostas_axs" ON public.fila_propostas_axs
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- Tipo de notificação do sino para falha definitiva da fila
-- (migration 087 deixou o CHECK sem ele; aqui entra junto)
-- ------------------------------------------------------------
DO $$
DECLARE
  c RECORD;
BEGIN
  -- mesmo mecanismo da migration 087: derruba qualquer CHECK da coluna tipo
  -- (o nome automático varia) e recria com a lista completa
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

  ALTER TABLE public.notificacoes
    ADD CONSTRAINT notificacoes_tipo_check
    CHECK (tipo IN (
      'atendimento_novo',
      'atendimento_mensagem',
      'tarefa_nova',
      'transbordo',
      'meta_alcancada',
      'chatbot',
      'meta_atingida',
      'kanban_parado',
      'remarketing',
      'fila_proposta_axs'
    ));
END
$$;
