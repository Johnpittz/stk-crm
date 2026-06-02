-- Desativa RLS na tabela preferencias_notificacoes para permitir acesso via client-side
ALTER TABLE public.preferencias_notificacoes DISABLE ROW LEVEL SECURITY;
