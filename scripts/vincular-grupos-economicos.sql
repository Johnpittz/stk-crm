-- ============================================================
-- VINCULAR CLIENTES A GRUPOS ECONOMICOS
-- Agrupa clientes por similaridade de nome (razão social)
-- ============================================================

-- 1. Verificar estrutura dos clientes
-- SELECT nome_razao_social, nome_fantasia, cpf_cnpj FROM public.clientes LIMIT 20;

-- 2. Desabilitar RLS
ALTER TABLE public.grupos_economicos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;

-- 3. Criar grupos econômicos baseados em nomes similares
-- Normaliza o nome: remove LTDA, EIRELI, SA, EPP, etc.
-- Todos com o mesmo nome normalizado = mesmo grupo

WITH clientes_normalizados AS (
  SELECT 
    id,
    nome_razao_social,
    -- Normaliza o nome: remove sufixos comerciais e espaços extras
    UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              TRIM(nome_razao_social),
              '\s*(LTDA|EIRELI|EPP|MEI|S/A|SA|LTDA\.|EIRELI\.|EPP\.)\s*$', '', 'i'
            ),
            '\s+', ' ', 'g'
          ),
          '^\s+|\s+$', '', 'g'
        ),
        '[^A-Z0-9 ]', '', 'g'
      )
    ) AS nome_normalizado
  FROM public.clientes
  WHERE nome_razao_social IS NOT NULL AND nome_razao_social != ''
),
-- Conta quantos clientes têm o mesmo nome normalizado
grupos AS (
  SELECT 
    nome_normalizado,
    COUNT(*) as qtd,
    MIN(nome_razao_social) as nome_exemplo
  FROM clientes_normalizados
  GROUP BY nome_normalizado
  HAVING COUNT(*) > 1  -- Só grupos com mais de 1 cliente
  ORDER BY qtd DESC
)
-- Insere os grupos
INSERT INTO public.grupos_economicos (nome, qtd_lojas)
SELECT nome_exemplo, qtd
FROM grupos
ON CONFLICT DO NOTHING;

-- 4. Vincula clientes aos grupos
UPDATE public.clientes c
SET grupo_economico_id = ge.id
FROM (
  SELECT 
    c2.id as cliente_id,
    ge2.id as grupo_id
  FROM public.clientes c2
  JOIN clientes_normalizados cn ON cn.id = c2.id
  JOIN public.grupos_economicos ge2 
    ON UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              TRIM(ge2.nome),
              '\s*(LTDA|EIRELI|EPP|MEI|S/A|SA|LTDA\.|EIRELI\.|EPP\.)\s*$', '', 'i'
            ),
            '\s+', ' ', 'g'
          ),
          '^\s+|\s+$', '', 'g'
        ),
        '[^A-Z0-9 ]', '', 'g'
      )
    ) = cn.nome_normalizado
  WHERE ge2.nome != c2.nome_razao_social  -- Exclui o próprio nome
) sub
WHERE c.id = sub.cliente_id;

-- 5. Reabilitar RLS
ALTER TABLE public.grupos_economicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 6. Verificar resultados
SELECT 
  ge.nome as grupo,
  ge.qtd_lojas,
  COUNT(c.id) as clientes_vinculados
FROM public.grupos_economicos ge
LEFT JOIN public.clientes c ON c.grupo_economico_id = ge.id
GROUP BY ge.id, ge.nome, ge.qtd_lojas
ORDER BY clientes_vinculados DESC
LIMIT 20;

-- 7. Verificar quantos clientes ainda não têm grupo
SELECT COUNT(*) AS clientes_sem_grupo
FROM public.clientes
WHERE grupo_economico_id IS NULL;