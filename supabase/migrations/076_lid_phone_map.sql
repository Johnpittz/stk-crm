-- Tabela de mapeamento LID → telefone para Evolution API v2.3.7+
-- Quando a Evolution envia remoteJid no formato @lid, precisamos resolver para o número real.
-- Esta tabela armazena o mapeamento para consultas futuras.

CREATE TABLE IF NOT EXISTS lid_phone_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lid TEXT NOT NULL,             -- ex: "70570624438404@lid"
  phone TEXT NOT NULL,           -- ex: "5562999264849"
  instance_name TEXT,            -- ex: "ROMA_1"
  push_name TEXT,                -- nome do contato (opcional)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lid, instance_name)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_lid_phone_map_lid ON lid_phone_map(lid);
CREATE INDEX IF NOT EXISTS idx_lid_phone_map_phone ON lid_phone_map(phone);
CREATE INDEX IF NOT EXISTS idx_lid_phone_map_instance ON lid_phone_map(instance_name);

-- RLS: service_role tem acesso total
ALTER TABLE lid_phone_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON lid_phone_map
  FOR ALL
  USING (true)
  WITH CHECK (true);
