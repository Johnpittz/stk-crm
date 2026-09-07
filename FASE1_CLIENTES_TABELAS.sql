-- ============================================
-- FASE 1: Tabela unificada de clientes
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Tabela principal de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Dados pessoais
  nome_completo TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  
  -- Endereço
  estado TEXT,
  cidade TEXT,
  endereco TEXT,
  
  -- Dados do negócio
  tipo_cliente TEXT DEFAULT 'individual', -- individual, empresa
  porte TEXT, -- pequeno, medio, grande
  atividade TEXT, -- comercio, industria, servicos, agronegocio, residencial
  
  -- Dados GD
  tem_gd BOOLEAN DEFAULT false,
  tipo_gd TEXT, -- solar_propria, solar_compartilhada, eolica, biomassa
  potencia_kwh NUMERIC(12,2),
  contrato_gd_numero TEXT,
  contrato_gd_data DATE,
  
  -- Dados RECIEE
  tem_reciee BOOLEAN DEFAULT false,
  uc TEXT, -- Unidade Consumidora
  distribuidora TEXT,
  grupo_cliente TEXT, -- A (alta tensao/demanda), B (consumidor)
  
  -- Classificação e relacionamento
  classificacao TEXT DEFAULT 'novo', -- novo, qualificado, ativo, inativo
  origem TEXT, -- disparo, indicacao, orgânico, reciee, gd, chatbot
  vendedor_responsavel_id UUID REFERENCES profiles(id),
  
  -- Estatísticas (atualizadas por triggers ou job)
  total_atendimentos INTEGER DEFAULT 0,
  total_tarefas INTEGER DEFAULT 0,
  ultima_interacao TIMESTAMPTZ,
  nota_satisfacao NUMERIC(3,1),
  
  -- Metadata
  observacoes TEXT,
  tags TEXT[], -- array de tags
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de documentos/faturas do cliente
CREATE TABLE IF NOT EXISTS cliente_documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- fatura_energia, proposta, contrato, relatorio_reciee, relatorio_gd
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT, -- URL do arquivo no Storage
  dados JSONB, -- dados extras (valores, datas, etc)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de histórico de interações
CREATE TABLE IF NOT EXISTS cliente_interacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- atendimento, tarefa, disparo, chatbot, nota, ligacao
  descricao TEXT NOT NULL,
  referencia_id UUID, -- ID do atendimento, tarefa, etc
  referencia_tipo TEXT, -- atendimento, tarefa, campanha, chatbot_session
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(vendedor_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_clientes_classificacao ON clientes(classificacao);
CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente ON cliente_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_interacoes_cliente ON cliente_interacoes(cliente_id);

-- 5. RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage clientes" ON clientes FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo IN ('admin', 'diretor')));
CREATE POLICY "Service role clientes" ON clientes FOR ALL USING (true);
CREATE POLICY "Admin manage cliente_documentos" ON cliente_documentos FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo IN ('admin', 'diretor')));
CREATE POLICY "Service role cliente_documentos" ON cliente_documentos FOR ALL USING (true);
CREATE POLICY "Admin manage cliente_interacoes" ON cliente_interacoes FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo IN ('admin', 'diretor')));
CREATE POLICY "Service role cliente_interacoes" ON cliente_interacoes FOR ALL USING (true);
