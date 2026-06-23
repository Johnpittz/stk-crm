-- ============================================================
-- ATUALIZAR PREÇOS DOS PRODUTOS
-- Todos os produtos estão com preco_venda = 0
-- Este script atribui preços realistas
-- ============================================================

-- 1. Verificar situação atual
SELECT COUNT(*) AS total_produtos, 
       COUNT(CASE WHEN preco_venda > 0 THEN 1 END) AS com_preco,
       COUNT(CASE WHEN preco_venda = 0 OR preco_venda IS NULL THEN 1 END) AS sem_preco
FROM public.produtos;

-- 2. Atribuir preços baseados no nome do produto
-- Produtos de segurança (DVR, CFTV, câmeras): R$ 200-2000
UPDATE public.produtos 
SET preco_venda = CASE 
  WHEN nome ILIKE '%dvr%' AND nome ILIKE '%32%' THEN 1800 + RANDOM() * 500
  WHEN nome ILIKE '%dvr%' AND nome ILIKE '%16%' THEN 800 + RANDOM() * 400
  WHEN nome ILIKE '%dvr%' AND nome ILIKE '%8%' THEN 400 + RANDOM() * 200
  WHEN nome ILIKE '%dvr%' THEN 500 + RANDOM() * 300
  WHEN nome ILIKE '%camera%' OR nome ILIKE '%cam%' THEN 150 + RANDOM() * 200
  WHEN nome ILIKE '%cftv%' THEN 300 + RANDOM() * 500
  WHEN nome ILIKE '%monitor%' THEN 600 + RANDOM() * 400
  WHEN nome ILIKE '%alarme%' THEN 200 + RANDOM() * 300
  WHEN nome ILIKE '%trancad%' OR nome ILIKE '%fechad%' THEN 150 + RANDOM() * 250
  WHEN nome ILIKE '%fio%' OR nome ILIKE '%cabo%' THEN 20 + RANDOM() * 80
  WHEN nome ILIKE '%disjuntor%' THEN 30 + RANDOM() * 100
  WHEN nome ILIKE '%led%' OR nome ILIKE '%lampad%' THEN 40 + RANDOM() * 150
  WHEN nome ILIKE '%interruptor%' OR nome ILIKE '%tomada%' THEN 15 + RANDOM() * 50
  WHEN nome ILIKE '%quadro%' THEN 100 + RANDOM() * 300
  WHEN nome ILIKE '%rack%' THEN 200 + RANDOM() * 400
  WHEN nome ILIKE '%fonte%' THEN 80 + RANDOM() * 200
  WHEN nome ILIKE '%acesso%' OR nome ILIKE '%controle%' THEN 300 + RANDOM() * 700
  ELSE 50 + RANDOM() * 200
END
WHERE preco_venda = 0 OR preco_venda IS NULL;

-- 3. Garantir que TODOS tenham pelo menos R$ 10
UPDATE public.produtos SET preco_venda = 10 + RANDOM() * 50 
WHERE preco_venda = 0 OR preco_venda IS NULL;

-- 4. Arredondar para 2 casas decimais
UPDATE public.produtos SET preco_venda = ROUND(preco_venda::numeric, 2);

-- 5. Verificar resultado
SELECT COUNT(*) AS total,
       COUNT(CASE WHEN preco_venda > 0 THEN 1 END) AS com_preco,
       ROUND(AVG(preco_venda)::numeric, 2) AS media_preco,
       ROUND(MIN(preco_venda)::numeric, 2) AS min_preco,
       ROUND(MAX(preco_venda)::numeric, 2) AS max_preco
FROM public.produtos;

-- 6. Ver alguns exemplos
SELECT nome, preco_venda FROM public.produtos ORDER BY preco_venda DESC LIMIT 10;