-- 104_bulk_campaigns_meta.sql (02/11/2026) — META de mensagens por disparo
-- (pedido do João: criar disparo com meta e acompanhar o progresso).
--
-- Enquanto esta migration NÃO rodar, o código já trata: o insert tenta com
-- `meta` e, se o Supabase reclamar da coluna, repete sem ela (nada trava).
-- Depois de aplicada, a meta grava e o modal de detalhe mostra
-- "🎯 Meta de mensagens: enviados / meta" com barra de progresso.

ALTER TABLE bulk_campaigns
  ADD COLUMN IF NOT EXISTS meta integer;

COMMENT ON COLUMN bulk_campaigns.meta IS
  'Meta de mensagens do disparo (progresso exibido no modal de detalhe)';
