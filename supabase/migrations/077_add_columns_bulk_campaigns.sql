-- Adicionar colunas faltantes na tabela bulk_campaigns
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id) ON DELETE SET NULL;
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS instancia TEXT DEFAULT 'ROMA_2';
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS intervalo INTEGER DEFAULT 5;

-- Índices
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_campanha_id ON bulk_campaigns(campanha_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_instancia ON bulk_campaigns(instancia);
