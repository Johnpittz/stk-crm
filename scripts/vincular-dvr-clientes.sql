-- ============================================================
-- VINCULAR CLIENTES AO DVR ESPECÍFICO DA PROMOÇÃO
-- Produto: DVR 04 CANAIS 1080N ACUSENSE IDS-7204HQHI-M1/E
-- ============================================================

-- 1. Encontrar o ID do DVR
SELECT id, nome, preco_venda FROM public.produtos 
WHERE nome ILIKE '%DVR%04%CANAIS%' OR nome ILIKE '%IDS-7204HQHI%'
LIMIT 5;

-- 2. Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;

-- 3. Criar 20 vendas com ESTE DVR para clientes diferentes
-- Primeiro: pegar o ID do DVR
DO $$
DECLARE
  v_dvr_id UUID;
  v_dvr_preco NUMERIC;
  v_cliente RECORD;
  v_venda_id UUID;
BEGIN
  -- Encontrar o DVR
  SELECT id, preco_venda INTO v_dvr_id, v_dvr_preco
  FROM public.produtos 
  WHERE nome ILIKE '%DVR%04%CANAIS%' OR nome ILIKE '%IDS-7204HQHI%'
  LIMIT 1;
  
  IF v_dvr_id IS NULL THEN
    RAISE NOTICE 'DVR não encontrado!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'DVR encontrado: % - R$ %', v_dvr_id, v_dvr_preco;
  
  -- Para cada cliente (primeiros 20)
  FOR v_cliente IN SELECT id FROM public.clientes ORDER BY created_at LIMIT 20 LOOP
  
    -- Criar venda
    INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
    VALUES (
      v_cliente.id,
      (SELECT id FROM public.profiles LIMIT 1),
      'V' || LPAD((30000 + (RANDOM() * 10000)::INTEGER)::TEXT, 5, '0'),
      CURRENT_DATE - (RANDOM() * 30 + 1)::INTEGER,
      0, 0, 0, 0, 'confirmada'
    ) RETURNING id INTO v_venda_id;
    
    -- Adicionar o DVR como item
    INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
    VALUES (v_venda_id, v_dvr_id, 1, v_dvr_preco, v_dvr_preco, 0);
    
    -- Atualizar total da venda
    UPDATE public.vendas SET valor_total = v_dvr_preco, valor_final = v_dvr_preco WHERE id = v_venda_id;
    
  END LOOP;
  
  RAISE NOTICE 'Vendas criadas com sucesso!';
END $$;

-- 4. Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- 5. Verificar
SELECT COUNT(*) AS vendas_com_dvr FROM public.venda_itens vi
JOIN public.produtos p ON p.id = vi.produto_id
WHERE p.nome ILIKE '%DVR%04%CANAIS%';

SELECT COUNT(*) AS clientes_que_compraram_dvr FROM (
  SELECT DISTINCT v.cliente_id
  FROM public.venda_itens vi
  JOIN public.vendas v ON v.id = vi.venda_id
  JOIN public.produtos p ON p.id = vi.produto_id
  WHERE p.nome ILIKE '%DVR%04%CANAIS%'
) sub;