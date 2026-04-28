-- Atualiza trigger de notificacao para tambem notificar em transferencias
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
  
  -- Se atendimento foi transferido (vendedor_id mudou)
  IF TG_OP = 'UPDATE' AND NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id AND NEW.vendedor_id IS NOT NULL THEN
    v_user_id := NEW.vendedor_id;
    v_titulo := 'Atendimento transferido para você';
    v_mensagem := COALESCE(NEW.nome_cliente, 'Cliente') || ' - ' || COALESCE(NEW.ultima_mensagem, 'Atendimento transferido');
    
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'transbordo', v_titulo, v_mensagem, jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id, 'telefone', NEW.telefone_cliente));
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
