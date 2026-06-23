-- ============================================================
-- PASSO 1: Verificar se existem clientes e vendedores
-- ============================================================
SELECT 'Clientes:' AS info, COUNT(*) AS total FROM public.clientes
UNION ALL
SELECT 'Vendedores:', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'Produtos:', COUNT(*) FROM public.produtos WHERE preco_venda > 0;

-- ============================================================
-- PASSO 2: Desabilitar RLS
-- ============================================================
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 3: Inserir vendas (uma por vez, simples)
-- ============================================================
DO $$
DECLARE
  v_cliente_id UUID;
  v_vendedor_id UUID;
  v_venda_id UUID;
  v_num INTEGER;
  v_produto RECORD;
  v_qtd INTEGER;
  v_valor NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Pega próximo número
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)), 0) + 1
  INTO v_num FROM public.vendas WHERE numero_pedido ~ '^V[0-9]+$';

  -- Para cada cliente (até 20)
  FOR v_cliente_id IN SELECT id FROM public.clientes ORDER BY created_at LIMIT 20 LOOP
  
    -- Pega um vendedor aleatório
    SELECT id INTO v_vendedor_id FROM public.profiles ORDER BY RANDOM() LIMIT 1;
    
    -- Cria a venda
    INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
    VALUES (v_cliente_id, v_vendedor_id, 'V' || LPAD(v_num::TEXT, 4, '0'), 
            CURRENT_DATE - (RANDOM() * 60)::INTEGER, 0, 0, 0, 0, 'confirmada')
    RETURNING id INTO v_venda_id;
    
    v_num := v_num + 1;
    v_total := 0;
    
    -- Adiciona 2 produtos aleatórios
    FOR v_produto IN SELECT id, preco_venda FROM public.produtos WHERE preco_venda > 0 ORDER BY RANDOM() LIMIT 2 LOOP
      v_qtd := 1 + (RANDOM() * 4)::INTEGER;
      v_valor := v_produto.preco_venda * v_qtd;
      
      INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
      VALUES (v_venda_id, v_produto.id, v_qtd, v_produto.preco_venda, v_valor, 0);
      
      v_total := v_total + v_valor;
    END LOOP;
    
    -- Atualiza total
    UPDATE public.vendas SET valor_total = v_total, valor_final = v_total WHERE id = v_venda_id;
    
  END LOOP;
  
  RAISE NOTICE 'Pronto! % vendas criadas', v_num;
END $$;

-- ============================================================
-- PASSO 4: Reabilitar RLS
-- ============================================================
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 5: Verificar
-- ============================================================
SELECT COUNT(*) AS total_vendas FROM public.vendas WHERE status = 'confirmada';
SELECT COUNT(*) AS total_itens FROM public.venda_itens;