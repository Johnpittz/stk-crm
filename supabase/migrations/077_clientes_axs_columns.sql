-- ============================================
-- FASE 1: Reestruturação da tabela clientes
-- Adiciona colunas para cadastro completo AXS
-- Execute no SQL Editor do Supabase
-- ============================================

-- Dados pessoais adicionais
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS rg_ie TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gender TEXT; -- M, F

-- Endereço completo
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep TEXT;

-- Dados da fatura / energia
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vencimento_fatura INTEGER; -- dia 1-31
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS classe_tarifaria TEXT; -- residencial, comercial, industrial, rural
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS subgrupo_tarifario TEXT; -- B1, B2, B3, A, etc.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS concessionaria TEXT; -- CEMIG, COPEL, CPFL, etc.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS instalacao TEXT; -- número de instalação/UC
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bandeira TEXT; -- amarela, vermelha1, vermelha2
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS iluminacao_publica NUMERIC(10,2);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consorcio TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usina TEXT;

-- Consumo mensal (12 meses)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_jan NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_fev NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_mar NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_abr NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_mai NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_jun NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_jul NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_ago NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_set NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_out NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_nov NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS consumo_dez NUMERIC(10,2) DEFAULT 0;

-- Geração própria (12 meses)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_propria BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_jan NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_fev NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_mar NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_abr NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_mai NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_jun NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_jul NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_ago NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_set NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_out NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_nov NUMERIC(10,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geracao_dez NUMERIC(10,2) DEFAULT 0;

-- Integração AXS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS axs_card_id TEXT; -- ID da proposta na AXS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS axs_status TEXT; -- status da proposta AXS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS axs_mensalidade NUMERIC(10,2); -- mensalidade AXS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS axs_data_envio TIMESTAMPTZ; -- data do envio para AXS

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_axs_card_id ON clientes(axs_card_id);
CREATE INDEX IF NOT EXISTS idx_clientes_concessionaria ON clientes(concessionaria);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes(whatsapp);
