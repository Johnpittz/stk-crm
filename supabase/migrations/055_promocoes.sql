-- Migration: Promoções / Campanhas de Produto
-- Cria tabela de promoções vinculadas a produtos

-- ============================================================
-- 1. Tabela de promoções
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promocoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo_promocao TEXT NOT NULL DEFAULT 'desconto_percentual'
    CHECK (tipo_promocao IN ('desconto_percentual', 'desconto_fixo', 'brinde', 'cashback')),
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'pausada', 'encerrada')),
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promocoes_status ON public.promocoes(status);
CREATE INDEX IF NOT EXISTS idx_promocoes_produto ON public.promocoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_promocoes_criado_por ON public.promocoes(criado_por);

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.promocoes ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados podem ver promoções ativas/pausadas
DROP POLICY IF EXISTS "authenticated_select_promocoes" ON public.promocoes;
CREATE POLICY "authenticated_select_promocoes" ON public.promocoes
  FOR SELECT TO authenticated
  USING (true);

-- Gestores podem criar/editar
DROP POLICY IF EXISTS "gestores_insert_promocoes" ON public.promocoes;
CREATE POLICY "gestores_insert_promocoes" ON public.promocoes
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por = auth.uid()
  );

DROP POLICY IF EXISTS "gestores_update_promocoes" ON public.promocoes;
CREATE POLICY "gestores_update_promocoes" ON public.promocoes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "gestores_delete_promocoes" ON public.promocoes;
CREATE POLICY "gestores_delete_promocoes" ON public.promocoes
  FOR DELETE TO authenticated
  USING (true);

-- Service Role bypass
DROP POLICY IF EXISTS "service_role_all_promocoes" ON public.promocoes;
CREATE POLICY "service_role_all_promocoes" ON public.promocoes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.promocoes TO authenticated;
GRANT ALL ON public.promocoes TO service_role;

-- ============================================================
-- 3. View para buscar clientes que compraram produto da promoção
-- ============================================================

CREATE OR REPLACE VIEW public.v_clientes_produto_promocao AS
SELECT
  vi.produto_id,
  v.cliente_id,
  c.nome_razao_social AS cliente_nome,
  c.telefone AS cliente_telefone,
  c.celular AS cliente_celular,
  COUNT(v.id) AS total_compras,
  SUM(vi.valor_total) AS valor_total_gasto,
  MAX(v.data_venda) AS ultima_compra,
  MIN(v.data_venda) AS primeira_compra
FROM public.venda_itens vi
JOIN public.vendas v ON v.id = vi.venda_id
JOIN public.clientes c ON c.id = v.cliente_id
WHERE v.status != 'cancelada'
GROUP BY vi.produto_id, v.cliente_id, c.nome_razao_social, c.telefone, c.celular;

GRANT SELECT ON public.v_clientes_produto_promocao TO authenticated;
GRANT SELECT ON public.v_clientes_produto_promocao TO service_role;