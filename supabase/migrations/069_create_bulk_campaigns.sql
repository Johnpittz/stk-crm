-- ============================================
-- Migration: Criar tabela de campanhas de disparo em massa
-- Data: 2026-08-19
-- Descrição: Tabela para armazenar campanhas de envio em massa
-- ============================================

-- Criar tabela de campanhas
CREATE TABLE IF NOT EXISTS bulk_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  numbers JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE bulk_campaigns ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir todas as operações (simplificado para MVP)
CREATE POLICY "Allow all operations on bulk_campaigns" ON bulk_campaigns
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON bulk_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_created_at ON bulk_campaigns(created_at DESC);

-- Comentários na tabela
COMMENT ON TABLE bulk_campaigns IS 'Campanhas de disparo em massa via WhatsApp';
COMMENT ON COLUMN bulk_campaigns.name IS 'Nome da campanha';
COMMENT ON COLUMN bulk_campaigns.message IS 'Mensagem a ser enviada';
COMMENT ON COLUMN bulk_campaigns.numbers IS 'Array de telefones (JSON)';
COMMENT ON COLUMN bulk_campaigns.status IS 'Status: pending, running, paused, completed, failed';
COMMENT ON COLUMN bulk_campaigns.sent IS 'Quantidade de mensagens enviadas com sucesso';
COMMENT ON COLUMN bulk_campaigns.failed IS 'Quantidade de mensagens que falharam';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_bulk_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_bulk_campaigns_updated_at
  BEFORE UPDATE ON bulk_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_campaigns_updated_at();

-- Verificação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'bulk_campaigns'
  ) THEN
    RAISE NOTICE '✅ Tabela bulk_campaigns criada com sucesso';
  ELSE
    RAISE NOTICE '❌ Erro ao criar tabela bulk_campaigns';
  END IF;
END $$;
