-- Migration: Tabelas RECIEE (Recuperação de Cobranças Indevidas de Energia Elétrica)
-- Data: 2026-09-04

-- Tabela de clientes RECIEE
CREATE TABLE IF NOT EXISTS clientes_reciee (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  uc TEXT NOT NULL,
  estado TEXT NOT NULL,
  distribuidora TEXT NOT NULL,
  subgrupo TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  classe TEXT NOT NULL,
  tensao TEXT NOT NULL,
  regime_tributario TEXT,
  gd BOOLEAN DEFAULT FALSE,
  grupo TEXT NOT NULL CHECK (grupo IN ('A', 'B')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de faturas RECIEE
CREATE TABLE IF NOT EXISTS faturas_reciee (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes_reciee(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  consumo_kwh NUMERIC(10,2) NOT NULL,
  tarifa_aplicada NUMERIC(10,4) NOT NULL,
  valor_consumo NUMERIC(10,2) NOT NULL,
  icms_valor NUMERIC(10,2) NOT NULL,
  icms_aliquota NUMERIC(5,2) NOT NULL,
  pis_valor NUMERIC(10,2) NOT NULL,
  cofins_valor NUMERIC(10,2) NOT NULL,
  bandeira TEXT NOT NULL,
  cip NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de análises RECIEE
CREATE TABLE IF NOT EXISTS analises_reciee (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID NOT NULL REFERENCES faturas_reciee(id) ON DELETE CASCADE,
  macro_indice TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  severidade TEXT NOT NULL CHECK (severidade IN ('critico', 'alerta', 'ok', 'info')),
  valor_estimado NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_reciee_cpf_cnpj ON clientes_reciee(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_reciee_uc ON clientes_reciee(uc);
CREATE INDEX IF NOT EXISTS idx_faturas_reciee_cliente_id ON faturas_reciee(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturas_reciee_competencia ON faturas_reciee(competencia);
CREATE INDEX IF NOT EXISTS idx_analises_reciee_fatura_id ON analises_reciee(fatura_id);
CREATE INDEX IF NOT EXISTS idx_analises_reciee_severidade ON analises_reciee(severidade);

-- RLS (Row Level Security)
ALTER TABLE clientes_reciee ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas_reciee ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises_reciee ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir acesso para usuários autenticados)
CREATE POLICY "Allow authenticated users to view clientes_reciee" ON clientes_reciee
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert clientes_reciee" ON clientes_reciee
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update clientes_reciee" ON clientes_reciee
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete clientes_reciee" ON clientes_reciee
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view faturas_reciee" ON faturas_reciee
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert faturas_reciee" ON faturas_reciee
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update faturas_reciee" ON faturas_reciee
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete faturas_reciee" ON faturas_reciee
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view analises_reciee" ON analises_reciee
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert analises_reciee" ON analises_reciee
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update analises_reciee" ON analises_reciee
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete analises_reciee" ON analises_reciee
  FOR DELETE USING (auth.role() = 'authenticated');
