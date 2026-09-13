-- ============================================
-- MIGRATION 083: Deduplicar v_unified_clientes por telefone
-- Cada número de telefone = 1 cliente único
-- Prioridade: cadastro > reciee > chatbot > atendimento
-- ============================================

DROP VIEW IF EXISTS v_unified_clientes;

CREATE OR REPLACE VIEW v_unified_clientes AS
WITH todos AS (
  -- 1. Clientes cadastrados
  SELECT
    c.id,
    COALESCE(c.nome_razao_social, 'Sem nome') AS nome,
    COALESCE(c.celular, c.telefone) AS telefone,
    c.email,
    c.cnpj_cpf AS cpf_cnpj,
    c.cidade,
    c.estado,
    'cadastro'::text AS origem,
    FALSE AS tem_atendimento,
    FALSE AS tem_chatbot,
    EXISTS(SELECT 1 FROM faturas_reciee f WHERE f.cliente_id = c.id) AS tem_faturas_reciee,
    COALESCE(c.updated_at, c.created_at) AS ultima_interacao,
    regexp_replace(COALESCE(COALESCE(c.celular, c.telefone), ''), '[^0-9]', '', 'g') AS tel_norm,
    1 AS prioridade
  FROM clientes c

  UNION ALL

  -- 2. Clientes RECIEE (sem telefone — agrupa por cpf_cnpj)
  SELECT
    cr.id,
    COALESCE(cr.nome, 'Sem nome') AS nome,
    NULL::text AS telefone,
    NULL::text AS email,
    cr.cpf_cnpj,
    NULL::text AS cidade,
    NULL::text AS estado,
    'reciee'::text AS origem,
    FALSE AS tem_atendimento,
    FALSE AS tem_chatbot,
    EXISTS(SELECT 1 FROM faturas_reciee f WHERE f.cliente_id = cr.id) AS tem_faturas_reciee,
    cr.created_at AS ultima_interacao,
    ''::text AS tel_norm,
    2 AS prioridade
  FROM clientes_reciee cr

  UNION ALL

  -- 3. Sessões chatbot
  SELECT
    cs.id,
    COALESCE(cs.nome_lead, 'Lead ' || RIGHT(cs.telefone, 4)) AS nome,
    cs.telefone,
    NULL::text AS email,
    NULL::text AS cpf_cnpj,
    NULL::text AS cidade,
    NULL::text AS estado,
    'chatbot'::text AS origem,
    FALSE AS tem_atendimento,
    TRUE AS tem_chatbot,
    FALSE AS tem_faturas_reciee,
    cs.created_at AS ultima_interacao,
    regexp_replace(COALESCE(cs.telefone, ''), '[^0-9]', '', 'g') AS tel_norm,
    3 AS prioridade
  FROM chatbot_sessions cs

  UNION ALL

  -- 4. Atendimentos
  SELECT
    a.id,
    COALESCE(a.nome_cliente, 'Cliente ' || RIGHT(a.telefone_cliente, 4)) AS nome,
    a.telefone_cliente AS telefone,
    NULL::text AS email,
    NULL::text AS cpf_cnpj,
    NULL::text AS cidade,
    NULL::text AS estado,
    CASE WHEN a.canal = 'whatsapp' THEN 'whatsapp'::text ELSE 'atendimento'::text END AS origem,
    TRUE AS tem_atendimento,
    FALSE AS tem_chatbot,
    FALSE AS tem_faturas_reciee,
    a.created_at AS ultima_interacao,
    regexp_replace(COALESCE(a.telefone_cliente, ''), '[^0-9]', '', 'g') AS tel_norm,
    4 AS prioridade
  FROM atendimentos a
),

-- Agrupar por telefone normalizado
agregado AS (
  SELECT
    tel_norm,
    bool_or(tem_atendimento) AS tem_atendimento,
    bool_or(tem_chatbot) AS tem_chatbot,
    bool_or(tem_faturas_reciee) AS tem_faturas_reciee,
    MAX(ultima_interacao) AS ultima_interacao,
    (ARRAY_AGG(nome ORDER BY LENGTH(nome) DESC, prioridade ASC))[1] AS nome,
    (ARRAY_AGG(email ORDER BY prioridade ASC))[1] AS email,
    (ARRAY_AGG(cpf_cnpj ORDER BY prioridade ASC))[1] AS cpf_cnpj,
    (ARRAY_AGG(cidade ORDER BY prioridade ASC))[1] AS cidade,
    (ARRAY_AGG(estado ORDER BY prioridade ASC))[1] AS estado,
    (ARRAY_AGG(telefone ORDER BY prioridade ASC))[1] AS telefone,
    (ARRAY_AGG(origem ORDER BY prioridade ASC))[1] AS origem,
    (ARRAY_AGG(id ORDER BY prioridade ASC))[1] AS id
  FROM todos
  WHERE tel_norm != '' AND tel_norm IS NOT NULL
  GROUP BY tel_norm

  UNION ALL

  -- Registros sem telefone (ex: RECIEE com CPF)
  SELECT
    tel_norm,
    bool_or(tem_atendimento),
    bool_or(tem_chatbot),
    bool_or(tem_faturas_reciee),
    MAX(ultima_interacao),
    (ARRAY_AGG(nome ORDER BY LENGTH(nome) DESC, prioridade ASC))[1],
    (ARRAY_AGG(email ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(cpf_cnpj ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(cidade ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(estado ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(telefone ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(origem ORDER BY prioridade ASC))[1],
    (ARRAY_AGG(id ORDER BY prioridade ASC))[1]
  FROM todos
  WHERE (tel_norm = '' OR tel_norm IS NULL) AND cpf_cnpj IS NOT NULL
  GROUP BY cpf_cnpj, tel_norm
)

SELECT id, nome, telefone, email, cpf_cnpj, cidade, estado, origem,
       tem_atendimento, tem_chatbot, tem_faturas_reciee, ultima_interacao
FROM agregado
ORDER BY nome;
