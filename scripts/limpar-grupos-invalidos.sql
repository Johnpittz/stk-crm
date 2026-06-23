-- ============================================================
-- LIMPAR GRUPOS INVÁLIDOS
-- Remove grupos com apenas 1 cliente (não são grupos de verdade)
-- ============================================================

-- 1. Ver quantos grupos têm apenas 1 cliente
SELECT ge.nome, COUNT(c.id) AS clientes
FROM public.grupos_economicos ge
LEFT JOIN public.clientes c ON c.grupo_economico_id = ge.id
GROUP BY ge.id, ge.nome
HAVING COUNT(c.id) <= 1
ORDER BY ge.nome;

-- 2. Desvincular clientes de grupos com apenas 1 cliente
UPDATE public.clientes
SET grupo_economico_id = NULL
WHERE grupo_economico_id IN (
  SELECT ge.id
  FROM public.grupos_economicos ge
  LEFT JOIN public.clientes c ON c.grupo_economico_id = ge.id
  GROUP BY ge.id
  HAVING COUNT(c.id) <= 1
);

-- 3. Deletar grupos órfãos (sem clientes vinculados)
DELETE FROM public.grupos_economicos
WHERE id NOT IN (
  SELECT DISTINCT grupo_economico_id
  FROM public.clientes
  WHERE grupo_economico_id IS NOT NULL
);

-- 4. Verificar resultado final
SELECT ge.nome, COUNT(c.id) AS clientes
FROM public.grupos_economicos ge
JOIN public.clientes c ON c.grupo_economico_id = ge.id
GROUP BY ge.id, ge.nome
ORDER BY clientes DESC;