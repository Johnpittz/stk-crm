-- ============================================================
-- ADICIONAR MAIS VENDAS E ITENS
-- Rode este script para criar mais dados de teste
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;

-- 2. Criar 50 novas vendas (números a partir de 20000)
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id,
  (SELECT id FROM public.profiles ORDER BY RANDOM() LIMIT 1),
  'V' || LPAD((20000 + ROW_NUMBER() OVER())::TEXT, 5, '0'),
  CURRENT_DATE - (RANDOM() * 90 + 1)::INTEGER,
  0, 0, 0, 0, 'confirmada'
FROM public.clientes c
CROSS JOIN generate_series(1, 2) gs
LIMIT 50;

-- 3. Adicionar 1 item para cada venda sem valor
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  p.id,
  2,
  p.preco_venda,
  p.preco_venda * 2,
  0
FROM public.vendas v
CROSS JOIN (
  SELECT id, preco_venda FROM public.produtos 
  WHERE preco_venda > 0 AND preco_venda IS NOT NULL
  ORDER BY RANDOM() LIMIT 1
) p
WHERE v.valor_total = 0
LIMIT 50;

-- 4. Adicionar mais 1 item para as mesmas vendas
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  p.id,
  1,
  p.preco_venda,
  p.preco_venda,
  0
FROM public.vendas v
CROSS JOIN (
  SELECT id, preco_venda FROM public.produtos 
  WHERE preco_venda > 100 AND preco_venda IS NOT NULL
  ORDER BY RANDOM() LIMIT 1
) p
WHERE v.valor_total = 0
LIMIT 50;

-- 5. Atualizar valores totais
UPDATE public.vendas 
SET valor_total = COALESCE(sub.total, 0),
    valor_final = COALESCE(sub.total, 0)
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id;

-- 6. Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 7. VERIFICAR
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;