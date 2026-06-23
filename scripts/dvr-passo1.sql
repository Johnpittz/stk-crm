-- PASSO 1: Descubra o ID do DVR
-- Rode isso PRIMEIRO e me envie o resultado
SELECT id, nome, preco_venda FROM public.produtos 
WHERE nome ILIKE '%DVR%04%' OR nome ILIKE '%7204HQHI%'
LIMIT 5;