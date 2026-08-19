-- ============================================
-- SQL COMPLETO PARA CRIAR TABELAS NO SUPABASE
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- ============================================

-- 1. Tabela de atendimentos (se não existir)
CREATE TABLE IF NOT EXISTS public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  vendedor_id UUID,
  canal TEXT DEFAULT 'whatsapp',
  telefone_cliente TEXT NOT NULL,
  nome_cliente TEXT,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido', 'fechado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  assunto TEXT,
  ultima_mensagem TEXT,
  ultima_mensagem_data TIMESTAMPTZ,
  ultima_mensagem_remetente TEXT,
  nao_lido BOOLEAN DEFAULT true,
  transbordado BOOLEAN DEFAULT false,
  vendedor_interagiu BOOLEAN DEFAULT false,
  data_fechamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para atendimentos
CREATE INDEX IF NOT EXISTS idx_atendimentos_vendedor_id ON public.atendimentos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON public.atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_telefone ON public.atendimentos(telefone_cliente);
CREATE INDEX IF NOT EXISTS idx_atendimentos_ultima_mensagem_data ON public.atendimentos(ultima_mensagem_data DESC);

-- RLS para atendimentos
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendedor_ve_seus_atendimentos" ON public.atendimentos;
CREATE POLICY "vendedor_ve_seus_atendimentos" ON public.atendimentos
  FOR ALL TO authenticated
  USING (vendedor_id = auth.uid() OR vendedor_id IS NULL);

DROP POLICY IF EXISTS "service_role_all_atendimentos" ON public.atendimentos;
CREATE POLICY "service_role_all_atendimentos" ON public.atendimentos
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;

-- 2. Tabela de mensagens do atendimento
CREATE TABLE IF NOT EXISTS public.atendimento_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL CHECK (remetente IN ('cliente', 'vendedor', 'sistema')),
  conteudo TEXT NOT NULL,
  tipo_midia TEXT DEFAULT 'texto' CHECK (tipo_midia IN ('texto', 'imagem', 'audio', 'documento')),
  url_midia TEXT,
  lida BOOLEAN DEFAULT false,
  enviada_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas de mídia (migration 067)
ALTER TABLE public.atendimento_mensagens 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Índices para mensagens
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_atendimento_id ON public.atendimento_mensagens(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_created_at ON public.atendimento_mensagens(created_at);
CREATE INDEX IF NOT EXISTS idx_atendimento_mensagens_media ON public.atendimento_mensagens(media_type) WHERE media_type IS NOT NULL;

-- RLS para mensagens
ALTER TABLE public.atendimento_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendedor_ve_mensagens_proprio_atendimento" ON public.atendimento_mensagens;
CREATE POLICY "vendedor_ve_mensagens_proprio_atendimento" ON public.atendimento_mensagens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.atendimentos a
      WHERE a.id = atendimento_mensagens.atendimento_id
      AND (a.vendedor_id = auth.uid() OR a.vendedor_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "service_role_all_mensagens" ON public.atendimento_mensagens;
CREATE POLICY "service_role_all_mensagens" ON public.atendimento_mensagens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.atendimento_mensagens TO authenticated;
GRANT ALL ON public.atendimento_mensagens TO service_role;

-- Trigger: atualiza ultima_mensagem quando insere mensagem
CREATE OR REPLACE FUNCTION public.atualizar_ultima_mensagem()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.atendimentos
  SET ultima_mensagem = NEW.conteudo,
      ultima_mensagem_data = NEW.created_at,
      ultima_mensagem_remetente = NEW.remetente
  WHERE id = NEW.atendimento_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atualizar_ultima_mensagem ON public.atendimento_mensagens;
CREATE TRIGGER trg_atualizar_ultima_mensagem
  AFTER INSERT ON public.atendimento_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_ultima_mensagem();

-- 3. Tabela de campanhas de disparo em massa
CREATE TABLE IF NOT EXISTS public.bulk_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  numbers JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para campanhas
ALTER TABLE public.bulk_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on bulk_campaigns" ON public.bulk_campaigns;
CREATE POLICY "Allow all operations on bulk_campaigns" ON public.bulk_campaigns
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para campanhas
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON public.bulk_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_created_at ON public.bulk_campaigns(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_bulk_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bulk_campaigns_updated_at ON public.bulk_campaigns;
CREATE TRIGGER trigger_update_bulk_campaigns_updated_at
  BEFORE UPDATE ON public.bulk_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_campaigns_updated_at();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Verificação das tabelas:';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'atendimentos') THEN
    RAISE NOTICE '  ✓ Tabela atendimentos criada';
  ELSE
    RAISE NOTICE '  ✗ Tabela atendimentos NÃO criada';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'atendimento_mensagens') THEN
    RAISE NOTICE '  ✓ Tabela atendimento_mensagens criada';
  ELSE
    RAISE NOTICE '  ✗ Tabela atendimento_mensagens NÃO criada';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bulk_campaigns') THEN
    RAISE NOTICE '  ✓ Tabela bulk_campaigns criada';
  ELSE
    RAISE NOTICE '  ✗ Tabela bulk_campaigns NÃO criada';
  END IF;
END $$;
