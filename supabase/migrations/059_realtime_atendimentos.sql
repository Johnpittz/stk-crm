-- Habilitar Supabase Realtime na tabela atendimentos
-- Isso permite que o frontend receba notificações em tempo real quando
-- uma mensagem chega via webhook (INSERT/UPDATE na tabela atendimentos)

-- Passo 1: Habilitar REPLICA IDENTITY FULL (necessário para Realtime capturar dados completos)
ALTER TABLE atendimentos REPLICA IDENTITY FULL;

-- Passo 2: Adicionar tabela à publicação do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;