-- ============================================================
-- GERAR VENDAS DE TESTE - 100% SQL PURO
-- Sem PL/pgSQL, sem loops, sem blocos DO $$
-- Copie TUDO e rode de uma vez
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- 2. Inserir 30 vendas (1 venda por cliente, 30 clientes)
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id,
  (ARRAY(SELECT id FROM public.profiles ORDER BY id))[1 + (ROW_NUMBER() OVER() % (SELECT GREATEST(COUNT(*),1) FROM public.profiles))],
  'V' || LPAD((9000 + ROW_NUMBER() OVER())::TEXT, 4, '0'),
  CURRENT_DATE - (RANDOM() * 90 + 1)::INTEGER,
  0, 0, 0, 0, 'confirmada'
FROM public.clientes c
LIMIT 30;

-- 3. Inserir itens: cada venda recebe 2 produtos aleatórios
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  sub.produto_id,
  sub.qtd,
  sub.preco,
  sub.preco * sub.qtd,
  0
FROM public.vendas v
JOIN LATERAL (
  SELECT id AS produto_id, preco_venda AS preco, (1 + (RANDOM() * 3)::INTEGER) AS qtd
  FROM public.produtos 
  WHERE preco_venda > 0 AND preco_venda IS NOT NULL
  ORDER BY RANDOM() 
  LIMIT 2
) sub ON true
WHERE v.numero_pedido >= 'V9001';

-- 4. Atualizar valores totais das vendas
UPDATE public.vendas 
SET valor_total = COALESCE(sub.total, 0),
    valor_final = COALESCE(sub.total, 0)
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id;

-- 5. Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 6. VERIFICAR
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;

-- 7. Ver produtos mais vendidos
SELECT p.nome, COUNT(vi.id) AS vezes_vendido, SUM(vi.quantidade) AS unidades
FROM public.venda_itens vi
JOIN public.produtos p ON p.id = vi.produto_id
GROUP BY p.nome
ORDER BY vezes_vendido DESC
LIMIT 10;