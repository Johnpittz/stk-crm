-- ============================================================
-- Gerar Vendas de Teste - Versão 3
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Desabilitar RLS temporariamente
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- Inserir vendas (números a partir do MAX existente)
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id AS cliente_id,
  (SELECT id FROM public.profiles ORDER BY RANDOM() LIMIT 1) AS vendedor_id,
  'V' || LPAD(
    (SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)), 0) FROM public.vendas 
     WHERE numero_pedido ~ '^V[0-9]+$') 
    + ROW_NUMBER() OVER()
  ::TEXT, 4, '0') AS numero_pedido,
  (CURRENT_DATE - (RANDOM() * 90)::INTEGER)::DATE AS data_venda,
  0 AS valor_total,
  0 AS valor_desconto,
  0 AS valor_frete,
  0 AS valor_final,
  'confirmada' AS status
FROM public.clientes c
CROSS JOIN generate_series(1, 2) AS gs
LIMIT 40;

-- Inserir itens de venda para as vendas novas (valor_total = 0)
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id AS venda_id,
  p.id AS produto_id,
  (1 + (RANDOM() * 3)::INTEGER) AS quantidade,
  p.preco_venda AS valor_unitario,
  p.preco_venda * (1 + (RANDOM() * 3)::INTEGER) AS valor_total,
  0 AS desconto_percentual
FROM public.vendas v
CROSS JOIN LATERAL (
  SELECT id, preco_venda 
  FROM public.produtos 
  WHERE preco_venda IS NOT NULL AND preco_venda > 0
  ORDER BY RANDOM()
  LIMIT 2
) p
WHERE v.valor_total = 0;

-- Atualizar valores totais
UPDATE public.vendas 
SET valor_total = sub.total,
    valor_final = sub.total
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id
  AND public.vendas.valor_total = 0;

-- Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- Verificar
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;