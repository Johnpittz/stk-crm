-- ============================================================
-- Criar usuário de Demonstração
-- Execute este SQL no Supabase SQL Editor (Dashboard > SQL Editor)
-- PRIMEIRO execute a migration 064, DEPOIS este arquivo
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Adicionar 'demonstracao' ao enum tipo_cargo (IMPORTANTE: executar primeiro!)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'demonstracao' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tipo_cargo')) THEN
    ALTER TYPE tipo_cargo ADD VALUE 'demonstracao';
  END IF;
END $$;

-- 1. Criar usuário no Auth
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'ed21c274-5cc9-40ca-9345-cee7b4625d5d',
  'authenticated',
  'authenticated',
  'demo@crm-roma.com',
  crypt('Demo@2026', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"nome_completo": "Usuário Demonstração", "cargo": "demonstracao"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- 2. Criar identidade
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  'ed21c274-5cc9-40ca-9345-cee7b4625d5d',
  'ed21c274-5cc9-40ca-9345-cee7b4625d5d',
  '{"sub": "ed21c274-5cc9-40ca-9345-cee7b4625d5d", "email": "demo@crm-roma.com"}'::jsonb,
  'email', 'demo@crm-roma.com', NOW(), NOW(), NOW()
);

-- 3. Criar profile (caso o trigger não crie automaticamente)
INSERT INTO public.profiles (id, nome_completo, cargo, email)
VALUES ('ed21c274-5cc9-40ca-9345-cee7b4625d5d', 'Usuário Demonstração', 'demonstracao', 'demo@crm-roma.com')
ON CONFLICT (id) DO UPDATE SET
  nome_completo = 'Usuário Demonstração', cargo = 'demonstracao', email = 'demo@crm-roma.com';

-- ============================================================
-- Email: demo@crm-roma.com
-- Senha: Demo@2026
-- ============================================================