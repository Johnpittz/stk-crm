-- Adicionar coluna imagem_url na tabela bulk_campaigns para disparos com imagem
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS imagem_url TEXT;

COMMENT ON COLUMN bulk_campaigns.imagem_url IS 'URL da imagem enviada após o texto no disparo (Supabase Storage)';
