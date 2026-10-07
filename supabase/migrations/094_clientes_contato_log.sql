-- 06/10/2026 — tela CLIENTES (pedido do João):
--   1) campos novos: NOME DO CONTATO / CARGO / CPF DO PROPRIETÁRIO /
--      DATA DE NASCIMENTO (abaixo de Data de Abertura);
--   2) colunas que a UI já escrevia mas NÃO existiam (o PUT quebrava):
--      tipo_cliente, classificacao;
--   3) LOG DE CRIAÇÃO/EDIÇÃO de clientes — leitura EXCLUSIVA de admin.
--
-- Idempotente: rodar de novo é seguro. Aplicar no SQL Editor do Supabase.

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome_contato TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cargo_contato TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_proprietario TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento_proprietario TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_cliente TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS classificacao TEXT;

CREATE TABLE IF NOT EXISTS cliente_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,             -- sem FK de propósito: o log sobrevive à exclusão do cliente
  cliente_nome TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('criado', 'editado')),
  campos TEXT[] NOT NULL DEFAULT '{}',
  usuario_id UUID,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliente_auditoria_created_at
  ON cliente_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_auditoria_cliente_id
  ON cliente_auditoria (cliente_id);

ALTER TABLE cliente_auditoria ENABLE ROW LEVEL SECURITY;

-- Leitura: só admin (perfil com cargo = 'admin')
DROP POLICY IF EXISTS "admin_le_cliente_auditoria" ON cliente_auditoria;
CREATE POLICY "admin_le_cliente_auditoria" ON cliente_auditoria
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));

-- Gravação: as rotas da API usam service_role
DROP POLICY IF EXISTS "service_role_all_cliente_auditoria" ON cliente_auditoria;
CREATE POLICY "service_role_all_cliente_auditoria" ON cliente_auditoria
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.cliente_auditoria TO service_role;
