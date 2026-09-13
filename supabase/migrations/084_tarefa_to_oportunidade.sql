-- ============================================================
-- Migration 084: Renomeação Tarefa → Oportunidade
-- Cria novas tabelas e migra dados existentes
-- ============================================================

-- 1. Criar tabela oportunidades
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Vinculação
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  atendimento_id UUID REFERENCES atendimentos(id) ON DELETE SET NULL,
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Dados da oportunidade
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'gd',  -- 'gd', 'reciee', 'axs'
  etapa TEXT NOT NULL DEFAULT 'recebeu_conta',
  prioridade TEXT DEFAULT 'media',
  
  -- Dados da conta/proposta
  uc TEXT,                          -- Unidade Consumidora
  consumo_kwh INTEGER,
  concessionaria TEXT,
  valor_proposta NUMERIC(12,2),
  valor_venda NUMERIC(12,2),
  
  -- Datas
  data_inicio DATE,
  hora_inicio TIME,
  data_fim DATE,
  hora_fim TIME,
  
  -- Resultado
  resultado TEXT,
  observacao_resultado TEXT,
  
  -- Controle
  ordem INTEGER DEFAULT 0,
  origem_lead TEXT,
  cliente_nome TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_oportunidades_vendedor ON oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa ON oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_oportunidades_atendimento ON oportunidades(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_created ON oportunidades(created_at DESC);

-- RLS
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

-- Vendedor vê suas próprias oportunidades
DROP POLICY IF EXISTS "vendedor_ve proprias oportunidades" ON oportunidades;
CREATE POLICY "vendedor_ve proprias oportunidades" ON oportunidades
  FOR ALL TO authenticated
  USING (vendedor_id = auth.uid())
  WITH CHECK (vendedor_id = auth.uid());

-- Gestores veem todas as oportunidades
DROP POLICY IF EXISTS "gestores_veem_todas_oportunidades" ON oportunidades;
CREATE POLICY "gestores_veem_todas_oportunidades" ON oportunidades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.cargo IN ('diretor', 'admin', 'gerente_comercial')
    )
  );

-- Service role total
DROP POLICY IF EXISTS "service_role_all_oportunidades" ON oportunidades;
CREATE POLICY "service_role_all_oportunidades" ON oportunidades
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 2. Criar tabela oportunidade_historico
-- ============================================================

CREATE TABLE IF NOT EXISTS oportunidade_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oportunidade_id UUID NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  etapa_anterior TEXT,
  etapa_nova TEXT NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidade_hist_oportunidade 
  ON oportunidade_historico(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidade_hist_created 
  ON oportunidade_historico(created_at DESC);

-- RLS
ALTER TABLE oportunidade_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_oportunidade_historico" ON oportunidade_historico;
CREATE POLICY "service_role_all_oportunidade_historico" ON oportunidade_historico
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_oportunidade_historico" ON oportunidade_historico;
CREATE POLICY "authenticated_read_oportunidade_historico" ON oportunidade_historico
  FOR SELECT TO authenticated
  USING (true);


-- ============================================================
-- 3. Criar tabela oportunidade_alertas (para detecção de conta)
-- ============================================================

CREATE TABLE IF NOT EXISTS oportunidade_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  mensagem_id UUID,
  tipo TEXT NOT NULL DEFAULT 'conta_detectada',
  confianca REAL DEFAULT 0.5,
  dados_extraidos JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pendente',  -- 'pendente', 'aceito', 'rejeitado'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidade_alertas_atendimento 
  ON oportunidade_alertas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_oportunidade_alertas_status 
  ON oportunidade_alertas(status);

-- RLS
ALTER TABLE oportunidade_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_oportunidade_alertas" ON oportunidade_alertas;
CREATE POLICY "service_role_all_oportunidade_alertas" ON oportunidade_alertas
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 4. Migrar dados de tarefas para oportunidades
-- ============================================================

INSERT INTO oportunidades (
  id, cliente_id, vendedor_id, titulo, descricao, tipo, etapa,
  prioridade, data_inicio, hora_inicio, data_fim, hora_fim,
  resultado, observacao_resultado, valor_venda, cliente_nome,
  ordem, origem_lead, created_at
)
SELECT 
  id, cliente_id, vendedor_id, titulo, descricao,
  COALESCE(
    CASE tipo
      WHEN 'prospeccao' THEN 'gd'
      ELSE 'gd'
    END,
    'gd'
  ) AS tipo,
  COALESCE(coluna_kanban, 'recebeu_conta') AS etapa,
  COALESCE(prioridade, 'media'),
  data_inicio, hora_inicio, data_fim, hora_fim,
  resultado, observacao_resultado, valor_venda, cliente_nome,
  COALESCE(ordem, 0), origem_lead, created_at
FROM tarefas
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 5. Criar function para updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_oportunidades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oportunidades_updated_at ON oportunidades;
CREATE TRIGGER trigger_oportunidades_updated_at
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION update_oportunidades_updated_at();


-- ============================================================
-- Nota: Tabela tarefas NÃO será deletada ainda
-- Manter para referência e rollback se necessário
-- ============================================================
