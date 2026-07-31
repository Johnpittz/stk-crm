# Migration Roteamento WhatsApp - Executar no Supabase

Copie o SQL abaixo e cole no **Supabase Dashboard → SQL Editor**, depois clique em **Run**.

```sql
-- Configuração de roteamento de atendimentos WhatsApp
-- Quando chega mensagem de número novo (sem vendedor no cadastro),
-- atribui automaticamente ao vendedor padrão configurado aqui.

CREATE TABLE IF NOT EXISTS config_roteamento_whatsapp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_padrao_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere o Valdean como vendedor padrão
INSERT INTO config_roteamento_whatsapp (vendedor_padrao_id, ativo)
VALUES ('da38fd55-bad4-42e8-8616-844530ad052c', true)
ON CONFLICT DO NOTHING;

-- GRANT permissões
GRANT ALL ON config_roteamento_whatsapp TO service_role;
GRANT SELECT ON config_roteamento_whatsapp TO authenticated;
```

## Verificar se rodou certinho

Depois de executar, rode este SQL para confirmar:

```sql
SELECT * FROM config_roteamento_whatsapp;
```

Deve retornar 1 linha com `vendedor_padrao_id = da38fd55-bad4-42e8-8616-844530ad052c` e `ativo = true`.

## Depois me avise para fazer o deploy!