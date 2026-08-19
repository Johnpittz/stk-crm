-- ============================================
-- Migration: Adicionar colunas de mídia nas mensagens
-- Data: 2026-08-19
-- Descrição: Adiciona suporte a imagens, áudio, vídeos e documentos
-- ============================================

-- Adiciona colunas de mídia na tabela de mensagens
ALTER TABLE atendimento_mensagens 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Cria índice para busca por tipo de mídia
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_media 
ON atendimento_mensagens(media_type) 
WHERE media_type IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN atendimento_mensagens.media_url IS 'URL ou base64 do arquivo de mídia';
COMMENT ON COLUMN atendimento_mensagens.media_type IS 'Tipo da mídia: image, audio, video, document';
COMMENT ON COLUMN atendimento_mensagens.file_name IS 'Nome do arquivo original';

-- Verificação
DO $$
BEGIN
  -- Verifica se as colunas foram criadas
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atendimento_mensagens' 
    AND column_name = 'media_url'
  ) THEN
    RAISE NOTICE '✅ Coluna media_url criada com sucesso';
  ELSE
    RAISE NOTICE '❌ Erro ao criar coluna media_url';
  END IF;
END $$;
