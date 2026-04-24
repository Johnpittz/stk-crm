-- Tabela de mensagens do chat de atendimento
CREATE TABLE IF NOT EXISTS public.atendimento_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL CHECK (remetente IN ('cliente', 'vendedor', 'sistema')),
  conteudo TEXT NOT NULL,
  tipo_midia TEXT DEFAULT 'texto' CHECK (tipo_midia IN ('texto', 'imagem', 'audio', 'documento')),
  url_midia TEXT,
  lida BOOLEAN DEFAULT false,
  enviada_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_atendimento_id ON public.atendimento_mensagens(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_created_at ON public.atendimento_mensagens(created_at);

-- RLS
ALTER TABLE public.atendimento_mensagens ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "vendedor_ve_mensagens_proprio_atendimento" ON public.atendimento_mensagens;
CREATE POLICY "vendedor_ve_mensagens_proprio_atendimento" ON public.atendimento_mensagens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.atendimentos a
      WHERE a.id = atendimento_mensagens.atendimento_id
      AND (a.vendedor_id = auth.uid() OR a.vendedor_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.atendimentos a
      WHERE a.id = atendimento_mensagens.atendimento_id
      AND (a.vendedor_id = auth.uid() OR a.vendedor_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "service_role_all_mensagens" ON public.atendimento_mensagens;
CREATE POLICY "service_role_all_mensagens" ON public.atendimento_mensagens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant
GRANT ALL ON public.atendimento_mensagens TO authenticated;
GRANT ALL ON public.atendimento_mensagens TO service_role;

-- Trigger: quando uma mensagem é inserida, atualiza atendimento.ultima_mensagem
CREATE OR REPLACE FUNCTION public.atualizar_ultima_mensagem()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.atendimentos
  SET ultima_mensagem = NEW.conteudo,
      ultima_mensagem_data = NEW.created_at
  WHERE id = NEW.atendimento_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atualizar_ultima_mensagem ON public.atendimento_mensagens;
CREATE TRIGGER trg_atualizar_ultima_mensagem
  AFTER INSERT ON public.atendimento_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_ultima_mensagem();
