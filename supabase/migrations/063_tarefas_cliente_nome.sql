-- Adiciona campo cliente_nome para tarefas com nome de cliente em texto livre
-- (quando não há cliente vinculado no cadastro)
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS cliente_nome TEXT DEFAULT NULL;

COMMENT ON COLUMN tarefas.cliente_nome IS 'Nome do cliente em texto livre (quando não vinculado via cliente_id)';