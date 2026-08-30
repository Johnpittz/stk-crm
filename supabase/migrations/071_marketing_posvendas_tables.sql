-- ============================================
-- MIGRATION: Tabelas para Marketing e Pós-Vendas
-- ============================================

-- 1. Tabela de Campanhas de Marketing
CREATE TABLE IF NOT EXISTS public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email', 'sms', 'multi_canal')),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'agendada', 'ativa', 'pausada', 'finalizada')),
  publico_alvo TEXT DEFAULT 'todos',
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  orcamento NUMERIC(10,2) DEFAULT 0,
  gasto NUMERIC(10,2) DEFAULT 0,
  meta_conversao INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para campanhas
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON public.campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_created_at ON public.campanhas(created_at DESC);

-- RLS para campanhas
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_campanhas" ON public.campanhas;
CREATE POLICY "allow_all_campanhas" ON public.campanhas
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;

-- 2. Tabela de Leads
CREATE TABLE IF NOT EXISTS public.leads_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa TEXT,
  telefone TEXT,
  email TEXT,
  origem TEXT NOT NULL DEFAULT 'whatsapp' CHECK (origem IN ('whatsapp', 'instagram', 'facebook', 'indicacao', 'site', 'outro')),
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'qualificado', 'em_contato', 'convertido', 'perdido')),
  score INTEGER DEFAULT 0,
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para leads
CREATE INDEX IF NOT EXISTS idx_leads_marketing_status ON public.leads_marketing(status);
CREATE INDEX IF NOT EXISTS idx_leads_marketing_origem ON public.leads_marketing(origem);
CREATE INDEX IF NOT EXISTS idx_leads_marketing_created_at ON public.leads_marketing(created_at DESC);

-- RLS para leads
ALTER TABLE public.leads_marketing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_leads_marketing" ON public.leads_marketing;
CREATE POLICY "allow_all_leads_marketing" ON public.leads_marketing
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.leads_marketing TO authenticated;
GRANT ALL ON public.leads_marketing TO service_role;

-- 3. Tabela de Promoções
CREATE TABLE IF NOT EXISTS public.promocoes_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'fixo', 'frete', 'quantidade')),
  valor NUMERIC(10,2) NOT NULL,
  uso_atual INTEGER DEFAULT 0,
  limite_uso INTEGER,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'agendada', 'finalizada', 'pausada')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para promoções
CREATE INDEX IF NOT EXISTS idx_promocoes_marketing_status ON public.promocoes_marketing(status);

-- RLS para promoções
ALTER TABLE public.promocoes_marketing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_promocoes_marketing" ON public.promocoes_marketing;
CREATE POLICY "allow_all_promocoes_marketing" ON public.promocoes_marketing
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.promocoes_marketing TO authenticated;
GRANT ALL ON public.promocoes_marketing TO service_role;

-- 4. Tabela de Chamados de Suporte (Pós-Vendas)
CREATE TABLE IF NOT EXISTS public.chamados_suporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_email TEXT,
  assunto TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'duvida' CHECK (categoria IN ('tecnico', 'financeiro', 'duvida', 'reclamacao', 'sugestao')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('critica', 'alta', 'media', 'baixa')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado')),
  atendente_id UUID,
  atendente_nome TEXT,
  tempo_resposta INTEGER,
  resolucao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para chamados
CREATE INDEX IF NOT EXISTS idx_chamados_suporte_status ON public.chamados_suporte(status);
CREATE INDEX IF NOT EXISTS idx_chamados_suporte_prioridade ON public.chamados_suporte(prioridade);
CREATE INDEX IF NOT EXISTS idx_chamados_suporte_created_at ON public.chamados_suporte(created_at DESC);

-- RLS para chamados
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_chamados_suporte" ON public.chamados_suporte;
CREATE POLICY "allow_all_chamados_suporte" ON public.chamados_suporte
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.chamados_suporte TO authenticated;
GRANT ALL ON public.chamados_suporte TO service_role;

-- 5. Tabela de Pedidos (Acompanhamento)
CREATE TABLE IF NOT EXISTS public.pedidos_acompanhamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  numero_pedido TEXT UNIQUE NOT NULL,
  produto TEXT NOT NULL,
  valor NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'preparando', 'em_transito', 'entregue', 'devolvido')),
  codigo_rastreio TEXT,
  transportadora TEXT,
  data_pedido TIMESTAMPTZ DEFAULT now(),
  data_previsao_entrega TIMESTAMPTZ,
  data_entrega_real TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_acompanhamento_status ON public.pedidos_acompanhamento(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_acompanhamento_cliente ON public.pedidos_acompanhamento(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_acompanhamento_created_at ON public.pedidos_acompanhamento(created_at DESC);

-- RLS para pedidos
ALTER TABLE public.pedidos_acompanhamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_pedidos_acompanhamento" ON public.pedidos_acompanhamento;
CREATE POLICY "allow_all_pedidos_acompanhamento" ON public.pedidos_acompanhamento
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.pedidos_acompanhamento TO authenticated;
GRANT ALL ON public.pedidos_acompanhamento TO service_role;

-- 6. Tabela de Follow-ups
CREATE TABLE IF NOT EXISTS public.followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ligacao', 'whatsapp', 'email', 'visita')),
  motivo TEXT NOT NULL,
  data_agendada TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'atrasado', 'agendado')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  responsavel_id UUID,
  responsavel_nome TEXT,
  resultado TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para follow-ups
CREATE INDEX IF NOT EXISTS idx_followups_status ON public.followups(status);
CREATE INDEX IF NOT EXISTS idx_followups_data_agendada ON public.followups(data_agendada);
CREATE INDEX IF NOT EXISTS idx_followups_created_at ON public.followups(created_at DESC);

-- RLS para follow-ups
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_followups" ON public.followups;
CREATE POLICY "allow_all_followups" ON public.followups
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.followups TO authenticated;
GRANT ALL ON public.followups TO service_role;

-- 7. Tabela de Avaliações de Satisfação
CREATE TABLE IF NOT EXISTS public.avaliacoes_satisfacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT NOT NULL,
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  tipo_nps TEXT CHECK (tipo_nps IN ('promotor', 'neutro', 'detrator')),
  comentario TEXT,
  pedido_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para avaliações
CREATE INDEX IF NOT EXISTS idx_avaliacoes_satisfacao_nota ON public.avaliacoes_satisfacao(nota);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_satisfacao_tipo_nps ON public.avaliacoes_satisfacao(tipo_nps);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_satisfacao_created_at ON public.avaliacoes_satisfacao(created_at DESC);

-- RLS para avaliações
ALTER TABLE public.avaliacoes_satisfacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_avaliacoes_satisfacao" ON public.avaliacoes_satisfacao;
CREATE POLICY "allow_all_avaliacoes_satisfacao" ON public.avaliacoes_satisfacao
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.avaliacoes_satisfacao TO authenticated;
GRANT ALL ON public.avaliacoes_satisfacao TO service_role;

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers em todas as tabelas
DROP TRIGGER IF EXISTS update_campanhas_updated_at ON public.campanhas;
CREATE TRIGGER update_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_marketing_updated_at ON public.leads_marketing;
CREATE TRIGGER update_leads_marketing_updated_at
  BEFORE UPDATE ON public.leads_marketing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promocoes_marketing_updated_at ON public.promocoes_marketing;
CREATE TRIGGER update_promocoes_marketing_updated_at
  BEFORE UPDATE ON public.promocoes_marketing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chamados_suporte_updated_at ON public.chamados_suporte;
CREATE TRIGGER update_chamados_suporte_updated_at
  BEFORE UPDATE ON public.chamados_suporte
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedidos_acompanhamento_updated_at ON public.pedidos_acompanhamento;
CREATE TRIGGER update_pedidos_acompanhamento_updated_at
  BEFORE UPDATE ON public.pedidos_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_followups_updated_at ON public.followups;
CREATE TRIGGER update_followups_updated_at
  BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migração concluída! Tabelas criadas:';
  RAISE NOTICE '  ✓ campanhas (Marketing)';
  RAISE NOTICE '  ✓ leads_marketing (Marketing)';
  RAISE NOTICE '  ✓ promocoes_marketing (Marketing)';
  RAISE NOTICE '  ✓ chamados_suporte (Pós-Vendas)';
  RAISE NOTICE '  ✓ pedidos_acompanhamento (Pós-Vendas)';
  RAISE NOTICE '  ✓ followups (Pós-Vendas)';
  RAISE NOTICE '  ✓ avaliacoes_satisfacao (Pós-Vendas)';
END $$;