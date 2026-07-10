-- ============================================
-- BACKUP + LIMPEZA DE ATENDIMENTOS DE TESTE
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- PASSO 1: BACKUP (cria tabelas de backup)
-- ============================================

-- Backup das mensagens
CREATE TABLE IF NOT EXISTS backup_atendimento_mensagens AS
SELECT * FROM atendimento_mensagens;

-- Backup dos atendimentos
CREATE TABLE IF NOT EXISTS backup_atendimentos AS
SELECT * FROM atendimentos;

-- Backup das notificações de atendimento
CREATE TABLE IF NOT EXISTS backup_notificacoes_atendimento AS
SELECT * FROM notificacoes WHERE tipo ILIKE '%atendimento%';

-- Mostra quantos registros foram salvos no backup
SELECT 
  (SELECT COUNT(*) FROM backup_atendimento_mensagens) AS mensagens_backup,
  (SELECT COUNT(*) FROM backup_atendimentos) AS atendimentos_backup,
  (SELECT COUNT(*) FROM backup_notificacoes_atendimento) AS notificacoes_backup;

-- ============================================
-- PASSO 2: LIMPEZA (só execute após confirmar
--          que os backups foram criados!)
-- ============================================

-- Apaga todas as mensagens de atendimento
DELETE FROM atendimento_mensagens;

-- Apaga todos os atendimentos
DELETE FROM atendimentos;

-- Apaga notificações relacionadas a atendimentos
DELETE FROM notificacoes WHERE tipo ILIKE '%atendimento%';

SELECT 'Limpeza concluída! Backups salvos nas tabelas backup_*' AS resultado;

-- ============================================
-- PASSO 3 (OPCIONAL): Se precisar reverter,
-- descomente as linhas abaixo:
-- ============================================
-- INSERT INTO atendimento_mensagens SELECT * FROM backup_atendimento_mensagens;
-- INSERT INTO atendimentos SELECT * FROM backup_atendimentos;
-- INSERT INTO notificacoes SELECT * FROM backup_notificacoes_atendimento;
