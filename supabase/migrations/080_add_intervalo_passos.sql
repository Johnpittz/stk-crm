-- Adicionar coluna para delay entre passos do fluxo (em segundos)
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS intervalo_passos INTEGER DEFAULT 2;

COMMENT ON COLUMN bulk_campaigns.intervalo_passos IS 'Delay entre passos do fluxo de mensagens (em segundos)';
