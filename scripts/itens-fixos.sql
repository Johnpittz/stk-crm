-- ============================================================
-- ADICIONAR ITENS NAS VENDAS - VALORES FIXOS
-- Sem subqueries complexas
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- 2. Pegar 1 produto que certamente tem preco_venda
SELECT id, nome, preco_venda FROM public.produtos WHERE preco_venda IS NOT NULL AND preco_venda > 0 ORDER BY id LIMIT 5;

-- 3. Rode o INSERT abaixo SUBSTITUINDO 'ID_PRODUTO_AQUI' pelo ID que apareceu acima
-- Exemplo: se o primeiro produto tem id = abc-123, substitua 'ID_PRODUTO_AQUI' por abc-123

-- INSERT COM ID DO PRODUTO (substitua o ID):
-- INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
-- SELECT v.id, 'ID_PRODUTO_AQUI'::uuid, 2, 50.00, 100.00, 0
-- FROM public.vendas v WHERE v.status = 'confirmada' AND v.valor_total = 0 LIMIT 30;

-- 4. OU rode este que funciona SEM precisar saber o ID do produto:
-- Usa o primeiro produto da tabela diretamente no INSERT

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
  WHERE preco_venda IS NOT NULL AND preco_venda > 0 
  ORDER BY id LIMIT 1
) p
WHERE v.status = 'confirmada'
  AND v.valor_total = 0
LIMIT 30;

-- 5. Verificar
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;

-- 6. Atualizar valores
UPDATE public.vendas 
SET valor_total = COALESCE(sub.total, 0),
    valor_final = COALESCE(sub.total, 0)
FROM (
  SELECT venda_id, SUM(valor_total) AS total
  FROM public.venda_itens
  GROUP BY venda_id
) sub
WHERE public.vendas.id = sub.venda_id;

-- 7. Reabilitar RLS
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 8. Verificar final
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;