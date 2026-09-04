-- ============================================
-- MIGRATION 072: CHATBOT INTELIGENTE
-- ============================================

-- 1. Tabela de fluxos do chatbot
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  instancia TEXT, -- qual instância WhatsApp usa este fluxo
  mensagem_inicial TEXT NOT NULL, -- primeira mensagem do bot
  horario_comercial JSONB DEFAULT '{"seg_sexta": "08:00-18:00", "sabado": "08:00-12:00"}'::jsonb,
  timeout_horas INTEGER DEFAULT 24, -- horas antes de timeout
  delay_min INTEGER DEFAULT 7, -- delay mínimo entre mensagens (segundos)
  delay_max INTEGER DEFAULT 10, -- delay máximo entre mensagens (segundos)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de etapas do fluxo (cada pergunta/decisão)
CREATE TABLE IF NOT EXISTS chatbot_flow_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL, -- ordem da etapa no fluxo
  chave TEXT NOT NULL, -- ex: 'perfil', 'objetivo', 'valor_conta'
  tipo TEXT NOT NULL DEFAULT 'pergunta', -- pergunta, decidir, mensagem_ia, classificar
  pergunta TEXT, -- texto da pergunta
  opcoes JSONB, -- [{"chave": "empresa", "texto": "Minha empresa"}, ...]
  redirecionar JSONB, -- {"empresa": "objetivo", "residencia": "fluxo_residencial"}
  usar_ia BOOLEAN DEFAULT false, -- se true, interpreta resposta livre com IA
  campo_resposta TEXT, -- onde salvar a resposta (ex: 'nome', 'telefone')
  condicao JSONB, -- {"chave": "perfil", "valor": "empresa"} — só mostra se condicao for verdadeira
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(flow_id, chave)
);

-- 3. Tabela de sessões do chatbot (uma por telefone)
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone TEXT NOT NULL,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id),
  step_atual TEXT NOT NULL DEFAULT 'inicio', -- chave da etapa atual
  respostas JSONB DEFAULT '{}'::jsonb, -- todas as respostas coletadas
  classificacao TEXT, -- A, B, C, D
  status TEXT DEFAULT 'ativa', -- ativa, concluida, timeout, encaminhada, cancelada
  instancia TEXT, -- instância WhatsApp
  nome_lead TEXT,
  ultimo_contato TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de mensagens do chatbot (histórico da conversa)
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL, -- 'bot', 'cliente', 'ia'
  conteudo TEXT NOT NULL,
  step_chave TEXT, -- qual etapa estávamos
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_telefone ON chatbot_sessions(telefone);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_status ON chatbot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_flow_steps_flow ON chatbot_flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages(session_id);

-- 6. RLS policies
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY "Admin manage chatbot_flows" ON chatbot_flows
  FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));

CREATE POLICY "Admin manage chatbot_flow_steps" ON chatbot_flow_steps
  FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));

CREATE POLICY "Admin manage chatbot_sessions" ON chatbot_sessions
  FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));

CREATE POLICY "Admin manage chatbot_messages" ON chatbot_messages
  FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE cargo = 'admin'));

-- Service role (para webhooks)
CREATE POLICY "Service role chatbot_flows" ON chatbot_flows FOR ALL USING (true);
CREATE POLICY "Service role chatbot_flow_steps" ON chatbot_flow_steps FOR ALL USING (true);
CREATE POLICY "Service role chatbot_sessions" ON chatbot_sessions FOR ALL USING (true);
CREATE POLICY "Service role chatbot_messages" ON chatbot_messages FOR ALL USING (true);

-- ============================================
-- FLUXO PADRÃO: SUSTENTALSKI (GD)
-- ============================================

INSERT INTO chatbot_flows (id, nome, descricao, mensagem_inicial, instancia)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Sustentalski - Geração Distribuída',
  'Fluxo de qualificação de leads para Geração Distribuída de energia',
  'Olá! 👋 Seja bem-vindo à Sustentalski.

Posso fazer algumas perguntas rápidas para entender o seu perfil e verificar se a Geração Distribuída pode ajudar a reduzir seus custos com energia.

É rapidinho. ⚡',
  'STK'
);

-- Etapas do fluxo
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar) VALUES
-- 1. Identificar perfil
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1, 'perfil', 'pergunta',
  'Primeiro, você está buscando uma solução para:',
  '[{"chave": "empresa", "texto": "Minha empresa"}, {"chave": "residencia", "texto": "Minha residência"}, {"chave": "outro", "texto": "Outro tipo de empreendimento"}]'::jsonb,
  '{"empresa": "objetivo", "residencia": "objetivo_residencial", "outro": "objetivo"}'::jsonb);

-- 2. Objetivo (empresa)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 'objetivo', 'pergunta',
  'O que você busca principalmente com a Geração Distribuída?',
  '[{"chave": "reduzir_conta", "texto": "Reduzir minha conta de energia", "pontos": 15}, {"chave": "previsibilidade", "texto": "Ter mais previsibilidade nos custos", "pontos": 10}, {"chave": "avaliar", "texto": "Avaliar uma oportunidade de geração", "pontos": 10}, {"chave": "entender", "texto": "Quero entender como funciona", "pontos": 5}, {"chave": "proposta", "texto": "Já estou buscando uma proposta", "pontos": 20}]'::jsonb,
  '{"reduzir_conta": "valor_conta", "previsibilidade": "valor_conta", "avaliar": "valor_conta", "entender": "valor_conta", "proposta": "valor_conta"}'::jsonb,
  '{"chave": "perfil", "valor": "empresa"}'::jsonb);

-- 2b. Objetivo (residencial)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 'objetivo_residencial', 'pergunta',
  'O que você busca principalmente com a Geração Distribuída?',
  '[{"chave": "reduzir_conta", "texto": "Reduzir minha conta de energia", "pontos": 15}, {"chave": "previsibilidade", "texto": "Ter mais previsibilidade nos custos", "pontos": 10}, {"chave": "avaliar", "texto": "Avaliar uma oportunidade", "pontos": 10}, {"chave": "entender", "texto": "Quero entender como funciona", "pontos": 5}]'::jsonb,
  '{"reduzir_conta": "valor_conta", "previsibilidade": "valor_conta", "avaliar": "valor_conta", "entender": "valor_conta"}'::jsonb,
  '{"chave": "perfil", "valor": "residencia"}'::jsonb);

-- 3. Valor da conta
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 3, 'valor_conta', 'pergunta',
  'Para entendermos o potencial da solução, qual é aproximadamente o valor médio da sua conta de energia?',
  '[{"chave": "ate_1000", "texto": "Até R$ 1.000", "pontos": 5}, {"chave": "1000_3000", "texto": "R$ 1.000 a R$ 3.000", "pontos": 10}, {"chave": "3000_10000", "texto": "R$ 3.000 a R$ 10.000", "pontos": 15}, {"chave": "10000_30000", "texto": "R$ 10.000 a R$ 30.000", "pontos": 20}, {"chave": "acima_30000", "texto": "Acima de R$ 30.000", "pontos": 25}, {"chave": "nao_sei", "texto": "Não sei informar", "pontos": 5}]'::jsonb,
  '{"ate_1000": "localizacao", "1000_3000": "localizacao", "3000_10000": "localizacao", "10000_30000": "localizacao", "acima_30000": "localizacao", "nao_sei": "localizacao"}'::jsonb);

-- 4. Localização (resposta livre)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, campo_resposta, usar_ia, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 4, 'localizacao', 'pergunta',
  'Em qual cidade/setor e estado está localizada a unidade?',
  'localizacao', true,
  '{"*": "tipo_negocio"}'::jsonb);

-- 5. Tipo de negócio (empresa)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 5, 'tipo_negocio', 'pergunta',
  'Qual é o tipo do seu negócio?',
  '[{"chave": "comercio", "texto": "Comércio"}, {"chave": "industria", "texto": "Indústria"}, {"chave": "agronegocio", "texto": "Agronegócio"}, {"chave": "condominio", "texto": "Condomínio"}, {"chave": "servicos", "texto": "Serviços"}, {"chave": "outro", "texto": "Outra atividade"}]'::jsonb,
  '{"comercio": "situacao_atual", "industria": "situacao_atual", "agronegocio": "situacao_atual", "condominio": "situacao_atual", "servicos": "situacao_atual", "outro": "tipo_negocio_outro"}'::jsonb,
  '{"chave": "perfil", "valor": "empresa"}'::jsonb);

-- 5b. Tipo de residência
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 5, 'tipo_residencia', 'pergunta',
  'Qual é o tipo de residência?',
  '[{"chave": "apartamento", "texto": "Apartamento"}, {"chave": "casa", "texto": "Casa"}, {"chave": "kitnet", "texto": "Kitnet"}, {"chave": "zona_rural", "texto": "Zona Rural"}, {"chave": "outros", "texto": "Outros"}]'::jsonb,
  '{"apartamento": "situacao_atual_residencial", "casa": "situacao_atual_residencial", "kitnet": "situacao_atual_residencial", "zona_rural": "situacao_atual_residencial", "outros": "tipo_residencia_outro"}'::jsonb,
  '{"chave": "perfil", "valor": "residencia"}'::jsonb);

-- 6. Situação atual (empresa)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 6, 'situacao_atual', 'pergunta',
  'Hoje sua empresa já possui algum sistema de geração de energia?',
  '[{"chave": "nao_possui", "texto": "Não", "pontos": 15}, {"chave": "solar_propria", "texto": "Sim, energia solar própria", "pontos": 10}, {"chave": "solar_compartilhada", "texto": "Sim, energia solar compartilhada", "pontos": 10}, {"chave": "avaliando", "texto": "Estou avaliando instalar", "pontos": 20}, {"chave": "nao_sei", "texto": "Não sei informar", "pontos": 5}]'::jsonb,
  '{"nao_possui": "decisao_compra", "solar_propria": "decisao_compra", "solar_compartilhada": "decisao_compra", "avaliando": "decisao_compra", "nao_sei": "decisao_compra"}'::jsonb,
  '{"chave": "perfil", "valor": "empresa"}'::jsonb);

-- 6b. Situação atual (residencial)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 6, 'situacao_atual_residencial', 'pergunta',
  'Você já possui algum sistema de geração de energia?',
  '[{"chave": "nao_possui", "texto": "Não", "pontos": 15}, {"chave": "solar_propria", "texto": "Sim, energia solar própria", "pontos": 10}, {"chave": "solar_compartilhada", "texto": "Sim, energia solar compartilhada", "pontos": 10}, {"chave": "avaliando", "texto": "Estou avaliando instalar", "pontos": 20}, {"chave": "nao_sei", "texto": "Não sei informar", "pontos": 5}]'::jsonb,
  '{"nao_possui": "decisao_compra", "solar_propria": "decisao_compra", "solar_compartilhada": "decisao_compra", "avaliando": "decisao_compra", "nao_sei": "decisao_compra"}'::jsonb,
  '{"chave": "perfil", "valor": "residencia"}'::jsonb);

-- 7. Decisão de compra (apenas empresa)
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar, condicao) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7, 'decisao_compra', 'pergunta',
  'Você participa da decisão sobre a contratação de soluções de energia da empresa?',
  '[{"chave": "sim_decisor", "texto": "Sim, sou o responsável pela decisão", "pontos": 20}, {"chave": "participa", "texto": "Participo da decisão", "pontos": 15}, {"chave": "precisa_apresentar", "texto": "Preciso apresentar para o responsável", "pontos": 10}, {"chave": "nao", "texto": "Não", "pontos": 5}]'::jsonb,
  '{"sim_decisor": "momento_compra", "participa": "momento_compra", "precisa_apresentar": "momento_compra", "nao": "momento_compra"}'::jsonb,
  '{"chave": "perfil", "valor": "empresa"}'::jsonb);

-- 8. Momento de compra
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, opcoes, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 8, 'momento_compra', 'pergunta',
  'Em quanto tempo você gostaria de avaliar ou contratar uma solução?',
  '[{"chave": "agora", "texto": "Quero analisar agora", "pontos": 25}, {"chave": "30_dias", "texto": "Nos próximos 30 dias", "pontos": 20}, {"chave": "3_meses", "texto": "Nos próximos 3 meses", "pontos": 10}, {"chave": "mais_3_meses", "texto": "Mais de 3 meses", "pontos": 5}, {"chave": "pesquisando", "texto": "Ainda estou pesquisando", "pontos": 0}]'::jsonb,
  '{"agora": "nome", "30_dias": "nome", "3_meses": "nome", "mais_3_meses": "nome", "pesquisando": "nome"}'::jsonb);

-- 9. Nome
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, campo_resposta, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 9, 'nome', 'pergunta',
  'Perfeito. Para que nosso especialista possa analisar seu caso, qual é o seu nome?',
  'nome', '{"*": "telefone"}');

-- 10. Telefone
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, campo_resposta, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 10, 'telefone', 'pergunta',
  'Qual é o melhor WhatsApp para entrarmos em contato?',
  'telefone', '{"*": "email"}');

-- 11. Email
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, campo_resposta, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 11, 'email', 'pergunta',
  'E qual é o seu melhor e-mail?',
  'email', '{"*": "pergunta_ouro"}');

-- 12. Pergunta de ouro
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, campo_resposta, usar_ia, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 12, 'pergunta_ouro', 'pergunta',
  'Para eu direcionar você para o especialista certo, o que você mais gostaria de melhorar na sua situação atual de energia?',
  'dor_real', true,
  '{"*": "classificar"}');

-- 13. Classificação automática
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 13, 'classificar', 'classificar',
  '{"*": "mensagem_final"}');

-- 14. Mensagem final
INSERT INTO chatbot_flow_steps (flow_id, ordem, chave, tipo, pergunta, redirecionar) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 14, 'mensagem_final', 'mensagem_final',
  'Perfeito, {{nome}}! Com as informações que você passou, conseguimos direcionar sua solicitação para um especialista da Sustentalski. Nosso time vai analisar o seu perfil e entrar em contato para entender melhor o seu cenário e apresentar as possibilidades para sua empresa. Obrigado pelo contato! ⚡',
  NULL);
