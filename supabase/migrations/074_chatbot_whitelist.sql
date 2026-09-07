-- Migration: Chatbot Whitelist
-- Controle de quais números recebem o chatbot

CREATE TABLE IF NOT EXISTS chatbot_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone TEXT NOT NULL,
  origem TEXT, -- 'disparo', 'manual', 'campanha'
  campanha_id UUID, -- referência ao bulk_campaigns
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(telefone)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chatbot_whitelist_telefone ON chatbot_whitelist(telefone);
CREATE INDEX IF NOT EXISTS idx_chatbot_whitelist_ativo ON chatbot_whitelist(ativo);

-- RLS
ALTER TABLE chatbot_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role chatbot_whitelist" ON chatbot_whitelist FOR ALL USING (true);
CREATE POLICY "Admin manage chatbot_whitelist" ON chatbot_whitelist FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));
