-- Migration: RLS para preferencias_notificacoes
-- Permite que cada usuario so acesse suas proprias preferencias

-- Garante que RLS esta ativo
ALTER TABLE public.preferencias_notificacoes ENABLE ROW LEVEL SECURITY;

-- Policies com verificacao de existencia
DO $$
BEGIN
  -- Policy: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'preferencias_notificacoes'
    AND policyname = 'Usuario ve proprias preferencias'
  ) THEN
    CREATE POLICY "Usuario ve proprias preferencias"
    ON public.preferencias_notificacoes
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;

  -- Policy: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'preferencias_notificacoes'
    AND policyname = 'Usuario insere proprias preferencias'
  ) THEN
    CREATE POLICY "Usuario insere proprias preferencias"
    ON public.preferencias_notificacoes
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
  END IF;

  -- Policy: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'preferencias_notificacoes'
    AND policyname = 'Usuario atualiza proprias preferencias'
  ) THEN
    CREATE POLICY "Usuario atualiza proprias preferencias"
    ON public.preferencias_notificacoes
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
