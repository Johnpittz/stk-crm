-- Migration 058: Integração WhatsApp BotConversa
-- Adiciona colunas para rastrear mensagens enviadas via WhatsApp

-- Colunas para rastreamento de mensagens WhatsApp
ALTER TABLE public.atendimento_mensagens 
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_message_status TEXT DEFAULT 'sent' 
    CHECK (whatsapp_message_status IN ('sent', 'delivered', 'read', 'failed'));

-- Índice para buscas por message_id (webhooks de status de entrega)
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_id 
  ON public.atendimento_mensagens(whatsapp_message_id) 
  WHERE whatsapp_message_id IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN public.atendimento_mensagens.whatsapp_message_id IS 'ID da mensagem no BotConversa/Meta para rastreamento';
COMMENT ON COLUMN public.atendimento_mensagens.whatsapp_message_status IS 'Status de entrega: sent, delivered, read, failed';