-- ============================================================
-- PASSO 1: Adicionar 'demonstracao' ao enum tipo_cargo
-- Execute este SQL PRIMEIRO no SQL Editor do Supabase
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'demonstracao' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tipo_cargo')
  ) THEN
    ALTER TYPE tipo_cargo ADD VALUE 'demonstracao';
  END IF;
END $$;

-- Após executar este SQL, aguarde a mensagem de sucesso
-- e DEPOIS execute o arquivo: demo-passo2-criar-usuario.sql