-- Tabela de notificações para atendimentos e outros eventos
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('atendimento_novo', 'atendimento_mensagem', 'tarefa_nova', 'transbordo', 'meta_alcancada')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON public.notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "usuarios_veem_proprias_notificacoes" ON public.notificacoes;
CREATE POLICY "usuarios_veem_proprias_notificacoes" ON public.notificacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all_notificacoes" ON public.notificacoes;
CREATE POLICY "service_role_all_notificacoes" ON public.notificacoes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant
GRANT ALL ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

-- Função para criar notificação quando atendimento é criado/atualizado
CREATE OR REPLACE FUNCTION public.criar_notificacao_atendimento()
RETURNS TRIGGER AS $$
DECLARE
  v_titulo TEXT;
  v_mensagem TEXT;
  v_user_id UUID;
BEGIN
  -- Se atendimento novo
  IF TG_OP = 'INSERT' THEN
    v_user_id := NEW.vendedor_id;
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_titulo := 'Novo atendimento WhatsApp';
    v_mensagem := COALESCE(NEW.nome_cliente, 'Cliente') || ': ' || COALESCE(NEW.ultima_mensagem, 'Nova mensagem recebida');
    
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'atendimento_novo', v_titulo, v_mensagem, jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id, 'telefone', NEW.telefone_cliente));
    
    RETURN NEW;
  END IF;
  
  -- Se atendimento atualizado com nova mensagem
  IF TG_OP = 'UPDATE' AND NEW.ultima_mensagem IS DISTINCT FROM OLD.ultima_mensagem THEN
    v_user_id := NEW.vendedor_id;
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_titulo := 'Nova mensagem de ' || COALESCE(NEW.nome_cliente, 'Cliente');
    v_mensagem := NEW.ultima_mensagem;
    
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'atendimento_mensagem', v_titulo, v_mensagem, jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id));
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trg_notificar_atendimento ON public.atendimentos;
CREATE TRIGGER trg_notificar_atendimento
  AFTER INSERT OR UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_notificacao_atendimento();
