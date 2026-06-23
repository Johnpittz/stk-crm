-- ============================================================
-- PASSO 1: Verificar dados
-- ============================================================
SELECT COUNT(*) AS clientes FROM public.clientes;
SELECT COUNT(*) AS vendedores FROM public.profiles;
SELECT COUNT(*) AS produtos FROM public.produtos WHERE preco_venda > 0;

-- ============================================================
-- PASSO 2: Desabilitar RLS
-- ============================================================
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 3: Inserir 5 vendas (INSERT puro, sem PL/pgSQL)
-- Rode ESTE bloco separadamente e veja se retorna "5 rows"
-- ============================================================
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  id,
  (SELECT id FROM public.profiles LIMIT 1),
  'V' || LPAD(ROW_NUMBER() OVER()::TEXT, 4, '0'),
  CURRENT_DATE - 5,
  0, 0, 0, 0, 'confirmada'
FROM public.clientes
LIMIT 5;

-- ============================================================
-- PASSO 4: Verificar se inseriu
-- ============================================================
SELECT id, numero_pedido, status FROM public.vendas ORDER BY created_at DESC LIMIT 10;

-- ============================================================
-- PASSO 5: Se apareceram vendas, rode isto para adicionar itens
-- ============================================================
-- Venda 1: pega a primeira venda criada e adiciona 2 produtos
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  (SELECT id FROM public.vendas WHERE status='confirmada' ORDER BY created_at DESC LIMIT 1 OFFSET 0),
  id,
  2,
  preco_venda,
  preco_venda * 2,
  0
FROM public.produtos 
WHERE preco_venda > 0 AND preco_venda < 500
LIMIT 2;

-- Venda 2
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  (SELECT id FROM public.vendas WHERE status='confirmada' ORDER BY created_at DESC LIMIT 1 OFFSET 1),
  id,
  3,
  preco_venda,
  preco_venda * 3,
  0
FROM public.produtos 
WHERE preco_venda > 0 AND preco_venda < 500
ORDER BY RANDOM()
LIMIT 2;

-- Venda 3
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  (SELECT id FROM public.vendas WHERE status='confirmada' ORDER BY created_at DESC LIMIT 1 OFFSET 2),
  id,
  1,
  preco_venda,
  preco_venda,
  0
FROM public.produtos 
WHERE preco_venda > 0 AND preco_venda < 500
ORDER BY RANDOM()
LIMIT 2;

-- Venda 4
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  (SELECT id FROM public.vendas WHERE status='confirmada' ORDER BY created_at DESC LIMIT 1 OFFSET 3),
  id,
  4,
  preco_venda,
  preco_venda * 4,
  0
FROM public.produtos 
WHERE preco_venda > 0 AND preco_venda < 500
ORDER BY RANDOM()
LIMIT 2;

-- Venda 5
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  (SELECT id FROM public.vendas WHERE status='confirmada' ORDER BY created_at DESC LIMIT 1 OFFSET 4),
  id,
  1,
  preco_venda,
  preco_venda,
  0
FROM public.produtos 
WHERE preco_venda > 0 AND preco_venda < 500
ORDER BY RANDOM()
LIMIT 2;

-- ============================================================
-- PASSO 6: Verificar itens
-- ============================================================
SELECT COUNT(*) AS total_itens FROM public.venda_itens;

-- ============================================================
-- PASSO 7: Reabilitar RLS
-- ============================================================
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;