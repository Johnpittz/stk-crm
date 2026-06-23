-- ============================================================
-- VINCULAR CLIENTES AO DVR DA PROMOÇÃO
-- Versão SEM PL/pgSQL - apenas CTEs e INSERT direto
-- ============================================================

-- 1. Verificar o DVR
SELECT id, nome, preco_venda FROM public.produtos 
WHERE nome ILIKE '%DVR%04%ACUSENSE%' OR nome ILIKE '%7204HQHI%'
LIMIT 3;

-- 2. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;

-- 3. Criar vendas com o DVR para 15 clientes
-- Usa CTE para pegar o ID do DVR e dos clientes

WITH dvr AS (
  SELECT id, preco_venda FROM public.produtos 
  WHERE nome ILIKE '%DVR%04%ACUSENSE%' OR nome ILIKE '%7204HQHI%'
  LIMIT 1
),
clientes_selecionados AS (
  SELECT id FROM public.clientes ORDER BY created_at LIMIT 15
),
vendas_novas AS (
  INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
  SELECT 
    cs.id,
    (SELECT id FROM public.profiles LIMIT 1),
    'V' || LPAD((50000 + ROW_NUMBER() OVER())::TEXT, 5, '0'),
    CURRENT_DATE - (10 + ROW_NUMBER() OVER())::INTEGER,
    d.preco_venda,
    0, 0, d.preco_venda, 'confirmada'
  FROM clientes_selecionados cs, dvr d
  RETURNING id, valor_total
)
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT vn.id, d.id, 1, d.preco_venda, d.preco_venda, 0
FROM vendas_novas vn, dvr d;

-- 4. Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 5. Verificar
SELECT COUNT(*) AS vendas_com_dvr FROM public.venda_itens vi
JOIN public.produtos p ON p.id = vi.produto_id
WHERE p.nome ILIKE '%7204HQHI%';

SELECT p.nome, COUNT(DISTINCT v.cliente_id) AS clientes
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
JOIN public.produtos p ON p.id = vi.produto_id
WHERE p.nome ILIKE '%7204HQHI%'
GROUP BY p.nome;