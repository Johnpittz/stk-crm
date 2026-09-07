-- ============================================
-- MIGRATION: DETALHE DE CLIENTES (Fase 1)
-- ============================================

-- 1. Tabela de interações do cliente (histórico unificado)
CREATE TABLE IF NOT EXISTS client_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'reciee', 'gd', 'chatbot', 'atendimento', 'venda', 'suporte', 'nota'
  titulo TEXT NOT NULL,
  descricao TEXT,
  dados JSONB DEFAULT '{}'::jsonb, -- dados específicos do tipo
  status TEXT, -- 'ativo', 'concluido', 'pendente', 'cancelado'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_client_interactions_cliente ON client_interactions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_tipo ON client_interactions(tipo);
CREATE INDEX IF NOT EXISTS idx_client_interactions_created ON client_interactions(created_at DESC);

-- 3. RLS
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role client_interactions" ON client_interactions
  FOR ALL USING (true);

CREATE POLICY "Authenticated read client_interactions" ON client_interactions
  FOR SELECT USING (auth.role() = 'authenticated');
