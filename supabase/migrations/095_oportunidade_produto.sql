-- Fase 3 do plano de dashboard: vincular PRODUTO à OPORTUNIDADE.
-- Produtos já existem (tabela `produtos`, semeados GD/RECIEE/ELETROPOSTO/
-- SIGMA SOLAR). Aqui só o vínculo — o Dashboard agrupa tempos e vendas
-- por produto a partir dele.

ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_oportunidades_produto ON oportunidades (produto_id);
