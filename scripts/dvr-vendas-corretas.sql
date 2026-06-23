-- ============================================================
-- VINCULAR CLIENTES AO DVR CORRETO DA PROMOÇÃO
-- ID do DVR: 8f701171-3ca5-446a-8b0a-bd80c690ee1b
-- Nome: DVR 04 CANAIS 1080P HIBRIDO FULL HD IDS-7204HQHI-M1/FA HIK
-- Preço: R$ 442.42
-- ============================================================

-- Desabilitar RLS
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;

-- Criar 15 vendas com o DVR HIKVISION para clientes diferentes
-- Usa INSERT direto com IDs fixos

INSERT INTO public.vendas (cliente_id, vendedor_id, numero_pedido, data_venda, valor_total, valor_desconto, valor_frete, valor_final, status)
SELECT 
  c.id,
  (SELECT id FROM public.profiles LIMIT 1),
  'V' || LPAD((60000 + ROW_NUMBER() OVER())::TEXT, 5, '0'),
  CURRENT_DATE - (10 + ROW_NUMBER() OVER())::INTEGER,
  442.42,
  0, 0, 442.42, 'confirmada'
FROM public.clientes c
ORDER BY c.created_at
LIMIT 15;

-- Inserir itens de venda para o DVR HIKVISION
-- Cada venda criada acima recebe 1 item com o DVR correto
INSERT INTO public.venda_itens (venda_id, produto_id, quantidade, valor_unitario, valor_total, desconto_percentual)
SELECT 
  v.id,
  '8f701171-3ca5-446a-8b0a-bd80c690ee1b'::uuid,
  1,
  442.42,
  442.42,
  0
FROM public.vendas v
WHERE v.numero_pedido >= 'V60000'
  AND v.status = 'confirmada'
LIMIT 15;

-- Reabilitar RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- VERIFICAR
SELECT COUNT(*) AS vendas_com_dvr_hik FROM public.venda_itens vi
WHERE vi.produto_id = '8f701171-3ca5-446a-8b0a-bd80c690ee1b'::uuid;

SELECT COUNT(DISTINCT v.cliente_id) AS clientes_diferentes
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
WHERE vi.produto_id = '8f701171-3ca5-446a-8b0a-bd80c690ee1b'::uuid;

-- Ver top produtos vendidos
SELECT p.nome, COUNT(DISTINCT v.cliente_id) AS clientes, SUM(vi.quantidade) AS unidades
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
JOIN public.produtos p ON p.id = vi.produto_id
GROUP BY p.nome
ORDER BY clientes DESC
LIMIT 10;