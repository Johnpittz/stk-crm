-- ============================================================
-- Gerar Vendas de Teste - Versão 4 (final)
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Desabilitar RLS temporariamente
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- Inserir vendas direto com INSERT simples
-- Usando clientes e vendedores existentes
WITH base AS (
  SELECT 
    (SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)), 0) 
     FROM public.vendas WHERE numero_pedido ~ '^V[0-9]+$') AS max_num
),
clientes_vendedores AS (
  SELECT 
    c.id AS cliente_id,
    (ARRAY(SELECT id FROM public.profiles))[1 + (ROW_NUMBER() OVER() % (SELECT COUNT(*) FROM public.profiles))] AS vendedor_id,
    ROW_NUMBER() OVER() AS rn
  FROM public.clientes c
  LIMIT 40
)
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  cv.cliente_id,
  cv.vendedor_id,
  'V' || LPAD((b.max_num + cv.rn)::TEXT, 4, '0'),
  (CURRENT_DATE - (RANDOM() * 90)::INTEGER)::DATE,
  0,
  0,
  0,
  0,
  'confirmada'
FROM clientes_vendedores cv, base b;

-- Inserir itens de venda para vendas sem valor
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  p.id,
  (1 + (RANDOM() * 3)::INTEGER),
  p.preco_venda,
  p.preco_venda * (1 + (RANDOM() * 3)::INTEGER),
  0
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