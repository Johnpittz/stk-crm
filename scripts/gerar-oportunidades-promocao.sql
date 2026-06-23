-- ============================================================
-- GERAR OPORTUNIDADES A PARTIR DAS PROMOÇÕES
-- Cria oportunidades para clientes que compraram produtos
-- que estão em promoção
-- ============================================================

-- 1. Desabilitar RLS
ALTER TABLE public.oportunidades DISABLE ROW LEVEL SECURITY;

-- 2. Criar oportunidades para clientes que compraram o DVR da promoção
-- Promoção: asdas (DVR HIKVISION IDS-7204HQHI-M1, 10% OFF, preço R$ 398.18)
INSERT INTO public.oportunidades (
  vendedor_id,
  cliente_id,
  tipo_origem,
  motivo_geracao,
  valor_estimado,
  probabilidade,
  contexto,
  estagio,
  status,
  created_at
)
SELECT 
  v.vendedor_id,
  v.cliente_id,
  'promocao_vigente',
  'Promoção: asdas — 10% OFF no DVR 04 CANAIS HIKVISION. Preço promocional: R$ 398,18 (de R$ 442,42)',
  398.18,
  70,
  jsonb_build_object(
    'promocao_id', (SELECT id FROM public.promocoes WHERE titulo = 'asdas' LIMIT 1),
    'promocao_titulo', 'asdas',
    'produto_nome', 'DVR 04 CANAIS 1080P HIBRIDO FULL HD IDS-7204HQHI-M1/FA HIK',
    'tipo_promocao', 'desconto_percentual',
    'valor_promocao', 10,
    'preco_original', 442.42,
    'preco_promocional', 398.18,
    'ultima_compra', v.data_venda::text
  ),
  'prospeccao',
  'aberta',
  NOW()
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
JOIN public.produtos p ON p.id = vi.produto_id
WHERE p.id = '8f701171-3ca5-446a-8b0a-bd80c690ee1b'::uuid
  AND v.status = 'confirmada'
  AND v.cliente_id IS NOT NULL
  AND v.vendedor_id IS NOT NULL
GROUP BY v.vendedor_id, v.cliente_id, v.data_venda
ON CONFLICT DO NOTHING;

-- 3. Reabilitar RLS
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

-- 4. Verificar
SELECT COUNT(*) AS total_oportunidades FROM public.oportunidades;
SELECT COUNT(*) AS oportunidades_promocao FROM public.oportunidades WHERE tipo_origem = 'promocao_vigente';

-- 5. Ver detalhes
SELECT 
  o.id,
  c.nome_razao_social AS cliente,
  p.nome_completo AS vendedor,
  o.motivo_geracao,
  o.valor_estimado,
  o.status,
  o.created_at
FROM public.oportunidades o
JOIN public.clientes c ON c.id = o.cliente_id
JOIN public.profiles p ON p.id = o.vendedor_id
WHERE o.tipo_origem = 'promocao_vigente'
ORDER BY o.created_at DESC
LIMIT 20;