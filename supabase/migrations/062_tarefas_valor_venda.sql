-- Migration 062: Adicionar coluna valor_venda na tabela tarefas
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(12,2) DEFAULT NULL;