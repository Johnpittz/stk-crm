-- ============================================================
-- Gerar Vendas de Teste para Promoções
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Busca os IDs de clientes e produtos existentes
-- Gera 30 vendas fictícias com 1-3 itens cada
-- Distribui entre os vendedores existentes

DO $$
DECLARE
  v_cliente RECORD;
  v_produto RECORD;
  v_vendedor RECORD;
  v_venda_id UUID;
  v_num_pedido INTEGER;
  v_data_venda DATE;
  v_valor_total NUMERIC;
  v_valor_item NUMERIC;
  v_qtd INTEGER;
  v_dias_offset INTEGER;
  v_vendedores UUID[];
  i INTEGER;
BEGIN
  -- Pega IDs dos vendedores
  SELECT ARRAY_AGG(id) INTO v_vendedores FROM public.profiles LIMIT 4;

  -- Se não tem vendedores, sai
  IF v_vendedores IS NULL OR array_length(v_vendedores, 1) = 0 THEN
    RAISE NOTICE 'Nenhum vendedor encontrado na tabela profiles';
    RETURN;
  END IF;

  -- Pega o último número de pedido existente (só os que seguem o padrão V###)
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(numero_pedido FROM 2) AS INTEGER)),
    100
  ) + 1 INTO v_num_pedido 
  FROM public.vendas 
  WHERE numero_pedido ~ '^V[0-9]+$';

  -- Para cada cliente (primeiros 20)
  FOR v_cliente IN 
    SELECT id FROM public.clientes ORDER BY created_at LIMIT 20
  LOOP
    -- Gera 1-2 vendas por cliente
    FOR i IN 1..2 LOOP
      v_dias_offset := floor(random() * 90)::INTEGER;
      v_data_venda := CURRENT_DATE - v_dias_offset;
      v_num_pedido := v_num_pedido + 1;
      v_valor_total := 0;

      -- Cria a venda
      INSERT INTO public.vendas (
        cliente_id,
        vendedor_id,
        numero_pedido,
        data_venda,
        valor_total,
        valor_desconto,
        valor_frete,
        valor_final,
        status,
        created_at
      ) VALUES (
        v_cliente.id,
        v_vendedores[1 + (random() * (array_length(v_vendedores, 1) - 1))::INTEGER],
        'V' || LPAD(v_num_pedido::TEXT, 3, '0'),
        v_data_venda,
        0, -- será atualizado
        0,
        0,
        0, -- será atualizado
        'confirmada',
        NOW() - (v_dias_offset || ' days')::INTERVAL
      ) RETURNING id INTO v_venda_id;

      -- Adiciona 1-3 itens aleatórios de produtos
      FOR v_produto IN
        SELECT id, preco_venda 
        FROM public.produtos 
        WHERE preco_venda IS NOT NULL AND preco_venda > 0
        ORDER BY random()
        LIMIT (1 + floor(random() * 3))::INTEGER
      LOOP
        v_qtd := 1 + floor(random() * 5)::INTEGER;
        v_valor_item := (v_produto.preco_venda * v_qtd);

        INSERT INTO public.venda_itens (
          venda_id,
          produto_id,
          quantidade,
          valor_unitario,
          valor_total,
          desconto_percentual
        ) VALUES (
          v_venda_id,
          v_produto.id,
          v_qtd,
          v_produto.preco_venda,
          v_valor_item,
          0
        );

        v_valor_total := v_valor_total + v_valor_item;
      END LOOP;

      -- Atualiza o valor total da venda
      UPDATE public.vendas 
      SET valor_total = v_valor_total,
          valor_final = v_valor_total
      WHERE id = v_venda_id;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Vendas de teste geradas com sucesso!';
END $$;

-- ============================================================
-- Verificar resultados
-- ============================================================
-- SELECT COUNT(*) as total_vendas FROM public.vendas WHERE status = 'confirmada';
-- SELECT COUNT(*) as total_itens FROM public.venda_itens;
-- SELECT p.nome, COUNT(vi.id) as vezes_vendido, SUM(vi.quantidade) as total_unidades
-- FROM public.venda_itens vi
-- JOIN public.produtos p ON p.id = vi.produto_id
-- GROUP BY p.nome
-- ORDER BY vezes_vendido DESC
-- LIMIT 10;