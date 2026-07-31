-- Migration 064: Usuário de Demonstração
-- Adiciona cargo 'demonstracao' e função auxiliar is_demo()

-- ============================================================
-- 1. Adicionar 'demonstracao' ao enum tipo_cargo
-- ============================================================
-- Nota: Se o enum já existe, precisamos adicionar o novo valor
-- O Supabase usa PostgreSQL, então vamos adicionar via ALTER TYPE

DO $$
BEGIN
  -- Tenta adicionar o valor ao enum (ignora erro se já existir)
  BEGIN
    ALTER TYPE tipo_cargo ADD VALUE IF NOT EXISTS 'demonstracao';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- 2. Função auxiliar: is_demo()
-- Retorna true se o usuário logado é de demonstração
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_demo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND cargo = 'demonstracao'
  );
$$;

-- Garante permissão de execução
GRANT EXECUTE ON FUNCTION public.is_demo() TO authenticated;

-- ============================================================
-- 3. Comentários para documentação
-- ============================================================
COMMENT ON FUNCTION public.is_demo() IS 
  'Verifica se o usuário logado tem cargo de demonstração. Usado para isolar dados do demo.';

COMMENT ON COLUMN public.profiles.cargo IS 
  'Cargo do usuário: vendedor, gerente_comercial, diretor, admin, demonstracao';