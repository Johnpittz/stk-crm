-- Migration: Preferências de Notificações
-- Tabela para armazenar configurações de notificações por usuário

CREATE TABLE IF NOT EXISTS public.preferencias_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  canal_push BOOLEAN NOT NULL DEFAULT true,
  notif_atendimentos BOOLEAN NOT NULL DEFAULT true,
  notif_tarefas BOOLEAN NOT NULL DEFAULT true,
  notif_oportunidades BOOLEAN NOT NULL DEFAULT true,
  notif_metas_campanhas BOOLEAN NOT NULL DEFAULT true,
  notif_prospeccao BOOLEAN NOT NULL DEFAULT true,
  som_ativado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.trg_atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_preferencias_notificacoes ON public.preferencias_notificacoes;
CREATE TRIGGER trg_atualizar_preferencias_notificacoes
  BEFORE UPDATE ON public.preferencias_notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_atualizar_updated_at();

-- Garantir que cada usuário tenha um registro padrão ao criar perfil
CREATE OR REPLACE FUNCTION public.trg_criar_preferencias_notificacoes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.preferencias_notificacoes (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_criar_preferencias_notificacoes ON public.profiles;
CREATE TRIGGER trg_criar_preferencias_notificacoes
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_criar_preferencias_notificacoes();

-- Inserir registros para usuários existentes que ainda não têm
INSERT INTO public.preferencias_notificacoes (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.preferencias_notificacoes)
ON CONFLICT (user_id) DO NOTHING;
