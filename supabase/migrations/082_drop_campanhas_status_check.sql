-- Remover CHECK constraint que limita valores de status
ALTER TABLE campanhas DROP CONSTRAINT IF EXISTS campanhas_status_check;
