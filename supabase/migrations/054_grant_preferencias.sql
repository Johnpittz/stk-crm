-- Garante permissões para a tabela preferencias_notificacoes
GRANT ALL ON TABLE public.preferencias_notificacoes TO authenticated;
GRANT ALL ON TABLE public.preferencias_notificacoes TO anon;
GRANT ALL ON TABLE public.preferencias_notificacoes TO postgres;

-- Garante permissão na sequence (se houver)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
