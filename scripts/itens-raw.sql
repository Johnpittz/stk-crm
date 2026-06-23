-- ============================================================
-- ADICIONAR ITENS - 100% VALORES FIXOS
-- Sem nenhuma subquery, sem CROSS JOIN
-- ============================================================

-- Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- Pegar o ID de um produto com preço (anote e substitua abaixo)
SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 LIMIT 1;

-- Agora rode este INSERT substituindo OS 2 IDs:
-- 1. ID_VENDA = pegue um id da tabela vendas
-- 2. ID_PRODUTO = pegue o id do produto acima

-- Primeiro veja as vendas:
SELECT id, numero_pedido FROM public.vendas WHERE status = 'confirmada' ORDER BY created_at DESC LIMIT 10;

-- ============================================================
-- INSERT SIMPLIFICADO: usa 1 produto para todas as vendas
-- ============================================================
-- Rode este trecho (substitua os IDs):

-- INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
-- VALUES 
--   ('ID_DA_VENDA_1'::uuid, 'ID_DO_PRODUTO'::uuid, 2, 50.00, 100.00, 0),
--   ('ID_DA_VENDA_2'::uuid, 'ID_DO_PRODUTO'::uuid, 3, 50.00, 150.00, 0),
--   ('ID_DA_VENDA_3'::uuid, 'ID_DO_PRODUTO'::uuid, 1, 50.00, 50.00, 0);

-- ============================================================
-- OU: INSERT AUTOMÁTICO SEM SUBQUERY (usa uma CTE simples)
-- ============================================================

-- Cria uma tabela temporária com os IDs
CREATE TEMPORARY TABLE tmp_produtos AS
SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 LIMIT 1;

-- Insere itens
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, t.id, 2, t.preco_venda, t.preco_venda * 2, 0
FROM public.vendas v, tmp_produtos t
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 30;

-- Limpa tabela temporária
DROP TABLE tmp_produtos;

-- Atualiza valores
UPDATE public.vendas 
SET valor_total = COALESCE(sub.total, 0), valor_final = COALESCE(sub.total, 0)
FROM (SELECT venda_id, SUM(valor_total) AS total FROM public.venda_itens GROUP BY venda_id) sub
WHERE public.vendas.id = sub.venda_id;

-- Reabilitar RLS
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- Verificar
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;