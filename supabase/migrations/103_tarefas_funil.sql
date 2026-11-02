-- 103_tarefas_funil.sql (02/11/2026) — colunas que o código do dashboard
-- e da API de tarefas usam, mas que a tabela `tarefas` nunca teve.
-- Sem elas: GET /api/tarefas falha no ORDER (coluna inexistente), o POST
-- falha no INSERT e o dashboard do funil fica sempre zerado.
--
-- A tabela foi criada fora do controle das migrations (nenhuma migration
-- anterior cria `tarefas`); as062/063 só adicionaram valor_venda e
-- cliente_nome, que já existem.

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS coluna_kanban text NOT NULL DEFAULT 'a_fazer';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'tarefa';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS hora_inicio time;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS data_fim date;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS hora_fim time;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tarefas_vendedor ON tarefas (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_coluna ON tarefas (coluna_kanban);
