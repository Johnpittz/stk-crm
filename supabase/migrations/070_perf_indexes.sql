-- Performance indexes for sync speedup
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_wa_msg_id 
  ON public.atendimento_mensagens(whatsapp_message_id) 
  WHERE whatsapp_message_id IS NOT NULL;

-- Composite index for dedup by content+remetente
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_dedup 
  ON public.atendimento_mensagens(atendimento_id, conteudo, remetente);

-- Index for atendimentos lookup by phone + instance + status
CREATE INDEX IF NOT EXISTS idx_atendimentos_phone_instance_status 
  ON public.atendimentos(telefone_cliente, instancia, status);
