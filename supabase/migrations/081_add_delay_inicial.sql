-- Delay antes do primeiro disparo (em segundos)
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS delay_inicial INTEGER DEFAULT 0;
COMMENT ON COLUMN bulk_campaigns.delay_inicial IS 'Aguardar X segundos antes de enviar para o primeiro contato';
