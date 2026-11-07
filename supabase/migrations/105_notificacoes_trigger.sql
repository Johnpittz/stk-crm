-- ============================================================
--105 — TRIGGER de notificações de atendimento (idempotente)
-- Problema: a tabela `notificacoes` EXISTE e o sino lê dela,
-- mas não há UMA notificação dos tipos atendimento_novo /
-- atendimento_mensagem em todo o histórico —379 atendimentos
-- com vendedor e nenhum alerta. O trigger
-- `trg_notificar_atendimento` (migration009) NÃO está ativo no
-- banco (a tabela provavelmente foi criada por outro caminho).
-- Sem SQL access na VPS, isto fica documentado aqui para ser
-- colado no SQL Editor do Supabase.
--
-- Idempotente: pode ser colado mais de uma vez sem quebrar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_notificacao_atendimento()
RETURNS TRIGGER AS $$
DECLARE
  v_titulo TEXT;
  v_mensagem TEXT;
  v_user_id UUID;
BEGIN
  -- Atendimento novo
  IF TG_OP = 'INSERT' THEN
    v_user_id := NEW.vendedor_id;
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_titulo := 'Novo atendimento WhatsApp';
    v_mensagem := COALESCE(NEW.nome_cliente, 'Cliente') || ': ' ||
                  COALESCE(NEW.ultima_mensagem, 'Nova mensagem recebida');

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'atendimento_novo', v_titulo, v_mensagem,
            jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id,
                               'telefone', NEW.telefone_cliente));

    RETURN NEW;
  END IF;

  -- Atendimento atualizado com mensagem nova
  IF TG_OP = 'UPDATE' AND NEW.ultima_mensagem IS DISTINCT FROM OLD.ultima_mensagem THEN
    v_user_id := NEW.vendedor_id;
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_titulo := 'Nova mensagem de ' || COALESCE(NEW.nome_cliente, 'Cliente');
    v_mensagem := NEW.ultima_mensagem;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'atendimento_mensagem', v_titulo, v_mensagem,
            jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id));

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notificar_atendimento ON public.atendimentos;
CREATE TRIGGER trg_notificar_atendimento
  AFTER INSERT OR UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_notificacao_atendimento();

-- Observações:
-- * O CHECK de `tipo` do banco JÁ aceita todo o catálogo do código
--   (checado em07/11: meta_atingida, chatbot, kanban_parado etc.
--   foram inseridos com sucesso) — nenhuma mudança de CHECK aqui.
-- * RLS da tabela: cada usuário vê só as próprias (009) — ok.
