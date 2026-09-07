-- ============================================
-- GATILHO DO CHATBOT: só ativa pra números de disparo
-- ============================================

-- 1. Campo gatilho no fluxo: 'todos' | 'disparo'
ALTER TABLE chatbot_flows ADD COLUMN IF NOT EXISTS gatilho TEXT DEFAULT 'todos';

-- 2. Tabela auxiliar: números que receberam disparo e devem ativar o bot
CREATE TABLE IF NOT EXISTS chatbot_gatilho_numeros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(flow_id, telefone)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_gatilho_telefone ON chatbot_gatilho_numeros(telefone);
CREATE INDEX IF NOT EXISTS idx_chatbot_gatilho_flow ON chatbot_gatilho_numeros(flow_id);

-- RLS
ALTER TABLE chatbot_gatilho_numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role chatbot_gatilho" ON chatbot_gatilho_numeros FOR ALL USING (true);

-- 3. Atualizar fluxo existente para gatilho 'disparo'
UPDATE chatbot_flows SET gatilho = 'disparo' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
