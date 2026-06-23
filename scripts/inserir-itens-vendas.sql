-- ============================================================
-- Esse script assume que já existem 30+ vendas com status 'confirmada'
-- e valor_total = 0. Ele apenas insere itens nelas.
-- Rode DEPOIS do script anterior (que criou as vendas)
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- 2. Inserir itens para CADA venda sem itens
-- Usa 50 produtos fixos (os primeiros com preco_venda > 0)
-- Cada venda recebe 2 itens

INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id AS venda_id,
  p.id AS produto_id,
  2 AS quantidade,
  p.preco_venda AS valor_unitario,
  p.preco_venda * 2 AS valor_total,
  0 AS desconto_percentual
FROM public.vendas v
CROSS JOIN (
  SELECT id, preco_venda 
  FROM public.produtos 
  WHERE preco_venda > 0 
  ORDER BY id 
  LIMIT 50
) p
WHERE v.status = 'confirmada'
  AND v.valor_total = 0
  AND (ROW_NUMBER() OVER (PARTITION BY v.id ORDER BY p.id) <= 2);

-- 3. Se o acima não funcionar, tente essa versão mais simples:
-- Insere apenas 10 vendas com 1 item cada

-- INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
-- SELECT 
--   v.id,
--   (SELECT id FROM public.produtos WHERE preco_venda > 0 LIMIT 1),
--   1,
--   (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 LIMIT 1),
--   (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 LIMIT 1),
--   0
-- FROM public.vendas v
-- WHERE v.status = 'confirmada'
--   AND v.valor_total = 0
-- LIMIT 10;

-- 4. Atualizar valores
UPDATE public.vendas 
SET valor_total = sub.total,
    valor_final = sub.total
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id;

-- 5. Reabilitar RLS
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 6. Verificar
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;