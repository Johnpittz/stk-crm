-- ============================================================
-- VERIFICAR DADOS EXISTENTES
-- ============================================================
SELECT 'Clientes' AS tabela, COUNT(*) AS total FROM public.clientes
UNION ALL SELECT 'Vendedores', COUNT(*) FROM public.profiles
UNION ALL SELECT 'Produtos com preco', COUNT(*) FROM public.produtos WHERE preco_venda > 0;

-- ============================================================
-- DESABILITAR RLS
-- ============================================================
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- INSERIR 5 VENDAS MANUAIS (teste)
-- Copie e cole apenas este bloco primeiro para testar:
-- ============================================================
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id,
  (SELECT id FROM public.profiles LIMIT 1),
  'V' || LPAD(((SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)), 0) FROM public.vendas WHERE numero_pedido ~ '^V[0-9]+$') + ROW_NUMBER() OVER())::TEXT, 4, '0'),
  CURRENT_DATE - (RANDOM() * 30)::INTEGER,
  0, 0, 0, 0, 'confirmada'
FROM public.clientes c
LIMIT 5;

-- VERIFICAR SE INSERIU
SELECT COUNT(*) AS vendas_inseridas FROM public.vendas WHERE status = 'confirmada';

-- ============================================================
-- SE INSERIU 5, rode o resto:
-- ============================================================

-- Inserir mais vendas (próximas 35)
INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id,
  (SELECT id FROM public.profiles ORDER BY RANDOM() LIMIT 1),
  'V' || LPAD(((SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)), 0) FROM public.vendas WHERE numero_pedido ~ '^V[0-9]+$') + ROW_NUMBER() OVER())::TEXT, 4, '0'),
  CURRENT_DATE - (RANDOM() * 60)::INTEGER,
  0, 0, 0, 0, 'confirmada'
FROM public.clientes c
CROSS JOIN generate_series(1, 2) gs
LIMIT 40;

-- Inserir itens de venda (para vendas sem valor)
DO $$
DECLARE
  v_rec RECORD;
  v_produto RECORD;
  v_total NUMERIC;
BEGIN
  FOR v_rec IN SELECT id FROM public.vendas WHERE valor_total = 0 LOOP
    v_total := 0;
    FOR v_produto IN SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 AND preco_venda < 1000 ORDER BY RANDOM() LIMIT 3 LOOP
      INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
      VALUES (v_rec.id, v_produto.id, 1 + (RANDOM()*3)::INTEGER, v_produto.preco_venda, v_produto.preco_venda * (1 + (RANDOM()*3)::INTEGER), 0);
      v_total := v_total + v_produto.preco_venda * (1 + (RANDOM()*3)::INTEGER);
    END LOOP;
    UPDATE public.vendas SET valor_total = v_total, valor_final = v_total WHERE id = v_rec.id;
  END LOOP;
END $$;

-- Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- VERIFICAR
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;