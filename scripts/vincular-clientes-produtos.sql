-- ============================================================
-- VINCULAR CLIENTES A VARIOS PRODUTOS
-- Adiciona itens de venda com produtos diferentes
-- para que as promoções tenham dados
-- ============================================================

-- Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- Adicionar itens com PRODUTOS DIVERSOS (primeiros 20 produtos)
-- Cada venda recebe 1 produto diferente

-- Produto 1
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 1, p.preco_venda, p.preco_venda, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 2
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 2, p.preco_venda, p.preco_venda * 2, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 1 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 3
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 1, p.preco_venda, p.preco_venda, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 2 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 4
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 3, p.preco_venda, p.preco_venda * 3, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 3 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 5
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 1, p.preco_venda, p.preco_venda, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 4 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 10
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 2, p.preco_venda, p.preco_venda * 2, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 9 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 15
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 1, p.preco_venda, p.preco_venda, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 14 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Produto 20
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT v.id, p.id, 4, p.preco_venda, p.preco_venda * 4, 0
FROM public.vendas v
CROSS JOIN (SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 19 LIMIT 1) p
WHERE v.status = 'confirmada' AND v.valor_total = 0
LIMIT 10;

-- Atualizar valores totais
UPDATE public.vendas 
SET valor_total = COALESCE(sub.total, 0),
    valor_final = COALESCE(sub.total, 0)
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id;

-- Reabilitar RLS
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- VERIFICAR
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;

-- Ver quantos clientes compraram CADA produto
SELECT p.nome, COUNT(DISTINCT v.cliente_id) AS clientes_compraram
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
JOIN public.produtos p ON p.id = vi.produto_id
GROUP BY p.nome
ORDER BY clientes_compraram DESC
LIMIT 20;