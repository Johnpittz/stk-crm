-- Migration: Prospecção Inteligente B2B
-- Adiciona suporte para importação de leads via CNAE

-- ============================================================
-- 1. Garantir canal de origem "Prospecção B2B"
-- ============================================================

-- Insere canal se não existir
INSERT INTO public.canais (nome, tipo, cor_identidade, ativo)
SELECT 'Prospecção B2B', 'online', '#14919B', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.canais WHERE nome = 'Prospecção B2B'
);

-- Insere canal para WhatsApp Orgânico se não existir
INSERT INTO public.canais (nome, tipo, cor_identidade, ativo)
SELECT 'WhatsApp Orgânico', 'whatsapp', '#25D366', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.canais WHERE nome = 'WhatsApp Orgânico'
);

-- Insere canal para Site
INSERT INTO public.canais (nome, tipo, cor_identidade, ativo)
SELECT 'Site', 'online', '#3B82F6', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.canais WHERE nome = 'Site'
);

-- ============================================================
-- 2. Tabela de log de importações de prospecção
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prospeccao_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.profiles(id),
  cnae_filtro TEXT,
  uf_filtro TEXT,
  cidade_filtro TEXT,
  quantidade_encontrada INTEGER DEFAULT 0,
  quantidade_importada INTEGER DEFAULT 0,
  dados_brutos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_importacoes_importado_por ON public.prospeccao_importacoes(importado_por);
CREATE INDEX IF NOT EXISTS idx_prospeccao_importacoes_created_at ON public.prospeccao_importacoes(created_at DESC);

ALTER TABLE public.prospeccao_importacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_veem_proprias_importacoes" ON public.prospeccao_importacoes;
CREATE POLICY "usuarios_veem_proprias_importacoes" ON public.prospeccao_importacoes
  FOR ALL TO authenticated
  USING (importado_por = auth.uid())
  WITH CHECK (importado_por = auth.uid());

DROP POLICY IF EXISTS "service_role_all_prospeccao_importacoes" ON public.prospeccao_importacoes;
CREATE POLICY "service_role_all_prospeccao_importacoes" ON public.prospeccao_importacoes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.prospeccao_importacoes TO authenticated;
GRANT ALL ON public.prospeccao_importacoes TO service_role;

-- ============================================================
-- 3. Trigger para notificar vendedor quando tarefa de prospecção é criada
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_notificacao_tarefa_prospeccao()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_nome TEXT;
BEGIN
  -- Busca nome do cliente
  SELECT nome_razao_social INTO v_cliente_nome
  FROM public.clientes WHERE id = NEW.cliente_id;

  IF NEW.vendedor_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, dados)
    VALUES (
      NEW.vendedor_id,
      'tarefa_nova',
      'Novo lead para prospecção',
      COALESCE(v_cliente_nome, 'Empresa') || ' foi importado e precisa ser contatado.',
      jsonb_build_object('tarefa_id', NEW.id, 'cliente_id', NEW.cliente_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabela tarefas
DROP TRIGGER IF EXISTS trg_notificar_tarefa_prospeccao ON public.tarefas;
CREATE TRIGGER trg_notificar_tarefa_prospeccao
  AFTER INSERT ON public.tarefas
  FOR EACH ROW
  WHEN (NEW.titulo LIKE 'Prospecção:%')
  EXECUTE FUNCTION public.criar_notificacao_tarefa_prospeccao();
