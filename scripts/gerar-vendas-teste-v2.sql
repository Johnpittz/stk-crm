-- ============================================================
-- Gerar Vendas de Teste - Versão Simples
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Primeiro: verificar se tem clientes e produtos
-- SELECT COUNT(*) FROM public.clientes;
-- SELECT COUNT(*) FROM public.produtos WHERE preco_venda > 0;
-- SELECT COUNT(*) FROM public.profiles;

-- ============================================================
-- Desabilitar RLS temporariamente para inserts de teste
-- ============================================================
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Inserir vendas diretamente (sem bloco PL/pgSQL)
-- ============================================================

-- Pega o próximo número de pedido
DO $$
DECLARE
  v_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)),
    0
  ) + 1 INTO v_num 
  FROM public.vendas 
  WHERE numero_pedido ~ '^V[0-9]+$';

  -- Inserir ~30 vendas usando CTEs
  -- Venda 1: cliente 1 comprou produto aleatório
  RAISE NOTICE 'Criando vendas a partir do numéro V%', LPAD(v_num::TEXT, 3, '0');
END $$;

-- Inserir vendas com INSERT direto usando subqueries
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id AS cliente_id,
  (SELECT id FROM public.profiles ORDER BY RANDOM() LIMIT 1) AS vendedor_id,
  'V' || LPAD((100 + ROW_NUMBER() OVER())::TEXT, 3, '0') AS numero_pedido,
  (CURRENT_DATE - (RANDOM() * 90)::INTEGER)::DATE AS data_venda,
  0 AS valor_total,
  0 AS valor_desconto,
  0 AS valor_frete,
  0 AS valor_final,
  'confirmada' AS status
FROM public.clientes c
CROSS JOIN generate_series(1, 2) AS gs  -- 2 vendas por cliente
LIMIT 40;

-- Inserir itens de venda para as vendas criadas agora
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
  LIMIT (1 + (RANDOM() * 2)::INTEGER)
) p
WHERE v.numero_pedido LIKE 'V1%'  -- vendas novas
  AND v.valor_total = 0;  -- só as que ainda não têm valor

-- Atualizar valores totais das vendas
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

-- ============================================================
-- Reabilitar RLS
-- ============================================================
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Verificar resultados
-- ============================================================
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;