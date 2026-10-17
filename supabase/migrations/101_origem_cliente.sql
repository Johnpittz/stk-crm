-- ============================================================
-- Migration 101: PARTE 11 (PPTX 17/10) — ORIGEM DO CLIENTE
--
-- No cadastro/edição, a Origem vira: tipo (vendedor/parceiro/
-- marketing) + subtipo (interno/externo etc.) + responsável
-- (vendedor vinculado via vendedor_responsavel_id, que JÁ EXISTE,
-- ou nome do parceiro). `origem_lead` continua sendo gravado com
-- o tipo (compat com dashboard / v_unified_clientes).
-- ============================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT,
  ADD COLUMN IF NOT EXISTS origem_subtipo TEXT,
  ADD COLUMN IF NOT EXISTS origem_indicacao_nome TEXT;

COMMENT ON COLUMN public.clientes.origem_tipo IS
  'PARTE 11: vendedor | parceiro | marketing';
COMMENT ON COLUMN public.clientes.origem_subtipo IS
  'PARTE 11: interno | externo | comercial | institucional | trafego_pago | outras_acoes';
COMMENT ON COLUMN public.clientes.origem_indicacao_nome IS
  'PARTE 11: nome do parceiro quando origem_tipo = parceiro';
