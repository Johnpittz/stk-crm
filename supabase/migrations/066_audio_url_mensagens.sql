-- Adiciona coluna url_audio na tabela atendimento_mensagens
-- Para suportar recebimento de áudio via WhatsApp (BotConversa)

ALTER TABLE atendimento_mensagens ADD COLUMN IF NOT EXISTS url_audio TEXT DEFAULT NULL;

COMMENT ON COLUMN atendimento_mensagens.url_audio IS 'URL do áudio recebido via WhatsApp (BotConversa)';