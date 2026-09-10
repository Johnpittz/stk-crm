-- Execute este SQL no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/nizreygwaqqojwrorpqo/sql/new

CREATE TABLE IF NOT EXISTS lid_phone_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lid TEXT NOT NULL,
  phone TEXT NOT NULL,
  instance_name TEXT,
  push_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lid, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_lid_phone_map_lid ON lid_phone_map(lid);
CREATE INDEX IF NOT EXISTS idx_lid_phone_map_phone ON lid_phone_map(phone);

ALTER TABLE lid_phone_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON lid_phone_map
  FOR ALL USING (true) WITH CHECK (true);
