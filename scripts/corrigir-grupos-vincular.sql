-- ============================================================
-- CORRIGIR E VINCULAR GRUPOS ECONOMICOS
-- ============================================================

-- 1. Adicionar coluna qtd_lojas se não existir
ALTER TABLE public.grupos_economicos
  ADD COLUMN IF NOT EXISTS qtd_lojas INTEGER DEFAULT 1;

-- 2. Desabilitar RLS
ALTER TABLE public.grupos_economicos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;

-- 3. Criar grupos a partir dos nomes dos clientes
-- Pega o primeiro nome como nome do grupo
INSERT INTO public.grupos_economicos (nome, qtd_lojas)
SELECT DISTINCT
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        UPPER(nome_razao_social),
        '\s*(LTDA|EIRELI|EPP|MEI|S/A|SA)\s*$', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  ) AS nome,
  1
FROM public.clientes
WHERE nome_razao_social IS NOT NULL
  AND nome_razao_social != ''
ON CONFLICT DO NOTHING;

-- 4. Vincular clientes aos grupos (versão simples)
UPDATE public.clientes c
SET grupo_economico_id = (
  SELECT ge.id
  FROM public.grupos_economicos ge
  WHERE UPPER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(ge.nome),
        '\s*(LTDA|EIRELI|EPP|MEI|S/A|SA)\s*$', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  ) = UPPER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(c.nome_razao_social),
        '\s*(LTDA|EIRELI|EPP|MEI|S/A|SA)\s*$', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  )
  LIMIT 1
)
WHERE c.nome_razao_social IS NOT NULL;

-- 5. Reabilitar RLS
ALTER TABLE public.grupos_economicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 6. Verificar
SELECT ge.nome, COUNT(c.id) AS clientes
FROM public.grupos_economicos ge
JOIN public.clientes c ON c.grupo_economico_id = ge.id
GROUP BY ge.id, ge.nome
ORDER BY clientes DESC
LIMIT 10;