-- Adiciona colunas para controle de leitura e remetente da última mensagem
ALTER TABLE public.atendimentos 
  ADD COLUMN IF NOT EXISTS ultima_mensagem_remetente TEXT CHECK (ultima_mensagem_remetente IN ('cliente', 'vendedor', 'sistema')),
  ADD COLUMN IF NOT EXISTS nao_lido BOOLEAN DEFAULT true;

-- Atualiza registros existentes: marca como não lido se tem mensagem
UPDATE public.atendimentos 
  SET nao_lido = true, ultima_mensagem_remetente = 'cliente'
  WHERE ultima_mensagem IS NOT NULL;

-- Atualiza o trigger para preencher ultima_mensagem_remetente
CREATE OR REPLACE FUNCTION public.atualizar_ultima_mensagem()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.atendimentos 
  SET ultima_mensagem = NEW.conteudo, 
      ultima_mensagem_data = NEW.created_at,
      ultima_mensagem_remetente = NEW.remetente,
      nao_lido = CASE WHEN NEW.remetente = 'cliente' THEN true ELSE false END
  WHERE id = NEW.atendimento_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant
GRANT ALL ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;
