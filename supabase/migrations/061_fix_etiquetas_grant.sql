-- Fix: Garantir permissões na tabela de etiquetas
GRANT ALL ON atendimento_etiquetas TO service_role;
GRANT ALL ON atendimento_etiquetas TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;