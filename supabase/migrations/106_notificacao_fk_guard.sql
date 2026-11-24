-- ============================================================
--106 — GUARDA de FK no trigger de notificações (URGENTE — destrava
-- as mensagens do Atendimento)
--
-- PROBLEMA (diagnosticado em24/111:15):
-- `notificacoes.user_id` referencia `auth.users(id)` (migration009),
-- mas o trigger da105 usa `NEW.vendedor_id` (id de PROFILES). Quando
-- o vendedor não tem usuário de login correspondente (profile sem
-- auth.users, ou profile removido), o INSERT viola a FK
-- `notificacoes_user_id_fkey` e DERRUBA A TRANSAÇÃO INTEIRA do
-- webhook → HTTP500 → a mensagem não grava no atendimento.
--
-- Evidência: payload real de webhook responde
--   500 {"error":"insert or update on table \"notificacoes\" violates
--   foreign key constraint \"notificacoes_user_id_fkey\""}
-- Última mensagem recebida no CRM:17/1118:57 (dia em que o SQL da105
-- foi colado). Todas as mensagens desde então se perdem.
--
-- CORREÇÃO: pular a notificação quando o destinatário não existe em
-- auth.users — a mensagem do atendimento passa normalmente; o sino
-- apenas não acende para quem não tem login (problema separado).
--
-- Idempotente: pode ser colado mais de uma vez.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_notificacao_atendimento()
RETURNS TRIGGER AS $$
DECLARE
  v_titulo TEXT;
  v_mensagem TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := NEW.vendedor_id;

  -- GUARDA (24/11): só notifica se o destinatário EXISTIR em auth.users.
  -- Sem esta guarda, a FK quebrava e derrubava o webhook inteiro.
  IF v_user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_titulo := 'Novo atendimento WhatsApp';
    v_mensagem := COALESCE(NEW.nome_cliente, 'Cliente') || ': ' ||
                  COALESCE(NEW.ultima_mensagem, 'Nova mensagem recebida');

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (v_user_id, 'atendimento_novo', v_titulo, v_mensagem,
            jsonb_build_object('atendimento_id', NEW.id, 'cliente_id', NEW.cliente_id,
                               'telefone', NEW.telefone_cliente));

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.ultima_mensagem IS DISTINCT FROM OLD.ultima_mensagem THEN
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
