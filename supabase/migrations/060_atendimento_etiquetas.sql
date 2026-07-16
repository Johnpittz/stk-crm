-- Migration 060: Tabela de etiquetas dos atendimentos
-- Permite vincular etiquetas (tags) a atendimentos específicos

CREATE TABLE IF NOT EXISTS atendimento_etiquetas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atendimento_id, etiqueta)
);

-- Índice para buscas rápidas por etiqueta
CREATE INDEX IF NOT EXISTS idx_atendimento_etiquetas_atendimento ON atendimento_etiquetas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_etiquetas_etiqueta ON atendimento_etiquetas(etiqueta);

-- RLS: desativar por enquanto (usa service_role)
ALTER TABLE atendimento_etiquetas DISABLE ROW LEVEL SECURITY;