-- ============================================================
-- Migration 085: Vincular clientes_reciee ao clientes
-- 
-- Adiciona coluna cliente_id na tabela clientes_reciee
-- para unificar tudo na "pasta do cliente".
--
-- Migra dados existentes via CPF/CNPJ (dígito a dígito).
-- ============================================================

-- 1. Adicionar coluna cliente_id (nullable primeiro para migração)
ALTER TABLE clientes_reciee 
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- 2. Migrar dados existentes: vincular por CPF/CNPJ (só dígitos)
UPDATE clientes_reciee cr
SET cliente_id = c.id
FROM clientes c
WHERE cr.cliente_id IS NULL
  AND (
    -- Match por dígitos do CPF/CNPJ
    regexp_replace(cr.cpf_cnpj, '[^0-9]', '', 'g') = 
    regexp_replace(c.cnpj_cpf, '[^0-9]', '', 'g')
  );

-- 3. Criar índice para performar consultas por cliente_id
CREATE INDEX IF NOT EXISTS idx_clientes_reciee_cliente_id 
  ON clientes_reciee(cliente_id);

-- 4. Adicionar constraint NOT NULL (depois da migração)
-- Só rodar se todos os registros tiverem sido vinculados
-- Descomentar se necessário:
-- ALTER TABLE clientes_reciee ALTER COLUMN cliente_id SET NOT NULL;

-- 5. Criar视图 atualizada que inclui dados do cliente principal
CREATE OR REPLACE VIEW v_reciee_completo AS
SELECT 
  cr.*,
  c.nome_razao_social as cliente_nome,
  c.telefone as cliente_telefone,
  c.celular as cliente_celular,
  c.email as cliente_email,
  c.cidade as cliente_cidade,
  c.estado as cliente_estado
FROM clientes_reciee cr
LEFT JOIN clientes c ON cr.cliente_id = c.id;

-- Log da migração
DO $$
DECLARE
  total_reciee INTEGER;
  vinculados INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_reciee FROM clientes_reciee;
  SELECT COUNT(*) INTO vinculados FROM clientes_reciee WHERE cliente_id IS NOT NULL;
  RAISE NOTICE '[Migration 085] Total RECIEE: %, Vinculados: %, Não vinculados: %', 
    total_reciee, vinculados, total_reciee - vinculados;
END $$;
