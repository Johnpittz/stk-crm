-- ============================================================
-- PASSO 2: Criar o usuário de demonstração
-- Execute APÓS o Passo 1 (adicionar enum) no SQL Editor do Supabase
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Criar usuário no Auth (cargo temporário 'vendedor' para o trigger funcionar)
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
  '{"nome_completo": "Usuário Demonstração", "cargo": "vendedor"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb
);

-- Criar identidade
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  'ed21c274-5cc9-40ca-9345-cee7b4625d5d',
  'ed21c274-5cc9-40ca-9345-cee7b4625d5d',
  '{"sub": "ed21c274-5cc9-40ca-9345-cee7b4625d5d", "email": "demo@crm-roma.com"}'::jsonb,
  'email', 'demo@crm-roma.com', NOW(), NOW(), NOW()
);

-- Profile (o trigger handle_new_user() cria com cargo 'vendedor')
-- Agora atualizamos para 'demonstracao'
UPDATE public.profiles 
SET nome_completo = 'Usuário Demonstração', cargo = 'demonstracao', email = 'demo@crm-roma.com'
WHERE id = 'ed21c274-5cc9-40ca-9345-cee7b4625d5d';

-- Se o trigger não existir, cria manualmente
INSERT INTO public.profiles (id, nome_completo, cargo, email)
VALUES ('ed21c274-5cc9-40ca-9345-cee7b4625d5d', 'Usuário Demonstração', 'demonstracao', 'demo@crm-roma.com')
ON CONFLICT (id) DO UPDATE SET
  nome_completo = 'Usuário Demonstração', cargo = 'demonstracao', email = 'demo@crm-roma.com';

-- ============================================================
-- ✅ Pronto! O usuário de demonstração está criado.
-- Email: demo@crm-roma.com
-- Senha: Demo@2026
-- ============================================================