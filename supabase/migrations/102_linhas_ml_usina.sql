-- ============================================================
-- Migration 102: FASE B (17/10) — novas linhas na pasta do cliente
--
-- O catálogo ganhou MERCADO_LIVRE e USINA (aba com inserção manual),
-- mas a CHECK da tabela (migration 099) só aceitava os 4 ids antigos:
-- o insert da aba nova voltava 400 "violates check constraint".
-- ============================================================

ALTER TABLE public.cliente_pasta_linhas
  DROP CONSTRAINT IF EXISTS cliente_pasta_linhas_linha_check;

ALTER TABLE public.cliente_pasta_linhas
  ADD CONSTRAINT cliente_pasta_linhas_linha_check
  CHECK (linha IN (
    'eletroposto',
    'sigma',
    'bess',
    'gestao_fatura',
    'mercado_livre',
    'usina'
  ));

-- Fim — sem dependência de dado
