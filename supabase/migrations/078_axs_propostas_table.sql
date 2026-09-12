-- ============================================
-- Tabela de propostas AXS sincronizadas
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS axs_propostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  axs_card_id TEXT NOT NULL,
  axs_status TEXT,
  axs_mensalidade NUMERIC(10,2),
  axs_dados JSONB DEFAULT '{}',
  vendedor_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, axs_card_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_axs_propostas_cliente ON axs_propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_axs_propostas_card_id ON axs_propostas(axs_card_id);

-- RLS
ALTER TABLE axs_propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users axs_propostas" ON axs_propostas
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Service role axs_propostas" ON axs_propostas
  FOR ALL USING (true);
