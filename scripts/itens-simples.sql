-- ============================================================
-- ADICIONAR ITENS NAS VENDAS EXISTENTES
-- Rode este script no SQL Editor do Supabase
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- 2. Ver quantas vendas sem itens existem
SELECT COUNT(*) AS vendas_sem_itens FROM public.vendas v
WHERE NOT EXISTS (SELECT 1 FROM public.venda_itens vi WHERE vi.venda_id = v.id);

-- 3. Pegar os primeiros 5 produtos com preco
SELECT id, nome, preco_venda FROM public.produtos WHERE preco_venda > 0 LIMIT 10;

-- 4. Inserir itens para TODAS as vendas (usando os primeiros 10 produtos)
-- Cada venda recebe 1 item
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  (SELECT id FROM public.produtos WHERE preco_venda > 0 ORDER BY id LIMIT 1),
  1,
  (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id LIMIT 1),
  (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id LIMIT 1),
  0
FROM public.vendas v
WHERE v.status = 'confirmada'
LIMIT 50;

-- 5. Inserir mais itens para as mesmas vendas (produto 2)
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  (SELECT id FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 1 LIMIT 1),
  2,
  (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 1 LIMIT 1),
  (SELECT preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY id OFFSET 1 LIMIT 1) * 2,
  0
FROM public.vendas v
WHERE v.status = 'confirmada'
LIMIT 50;

-- 6. Atualizar valores totais
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

-- 8. Verificar
SELECT COUNT(*) AS total_itens FROM public.venda_itens;
SELECT COUNT(*) AS vendas_com_valor FROM public.vendas WHERE valor_total > 0;