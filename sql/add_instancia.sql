-- Adicionar coluna instancia na tabela atendimentos
-- para rastrear qual instância WhatsApp recebeu cada conversa
ALTER TABLE public.atendimentos 
ADD COLUMN IF NOT EXISTS instancia TEXT DEFAULT 'minha-conexao';

-- Criar índice para performance na filtragem por instância
CREATE INDEX IF NOT EXISTS idx_atendimentos_instancia ON public.atendimentos(instancia);

-- Atualizar atendimentos existentes sem instância para 'minha-conexao' (padrão)
UPDATE public.atendimentos SET instancia = 'minha-conexao' WHERE instancia IS NULL;
