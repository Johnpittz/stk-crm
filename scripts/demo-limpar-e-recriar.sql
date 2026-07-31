-- ============================================================
-- LIMPAR e RE-CRIAR usuário de demonstração
-- O SQL anterior inseriu dados diretamente em auth.users
-- causando conflito. Execute este SQL para limpar e recriar.
-- ============================================================

-- 1. Limpar dados existentes
DELETE FROM public.profiles WHERE id = 'ed21c274-5cc9-40ca-9345-cee7b4625d5d';
DELETE FROM auth.identities WHERE id = 'ed21c274-5cc9-40ca-9345-cee7b4625d5d';
DELETE FROM auth.users WHERE id = 'ed21c274-5cc9-40ca-9345-cee7b4625d5d';

-- Se ainda existir algo com esse email, remove também
DELETE FROM auth.users WHERE email = 'demo@crm-roma.com';
DELETE FROM auth.identities WHERE provider_id = 'demo@crm-roma.com';

-- 2. Confirmar que limpou
SELECT 'Dados limpos' as status;