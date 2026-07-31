# Migration Áudio - Executar no Supabase

Copie o SQL abaixo e cole no **Supabase Dashboard → SQL Editor**, depois clique em **Run**.

```sql
-- Adiciona coluna url_audio na tabela atendimento_mensagens
-- Para suportar recebimento de áudio via WhatsApp (BotConversa)
ALTER TABLE atendimento_mensagens ADD COLUMN IF NOT EXISTS url_audio TEXT DEFAULT NULL;
COMMENT ON COLUMN atendimento_mensagens.url_audio IS 'URL do áudio recebido via WhatsApp (BotConversa)';
```

## Verificar se rodou certinho

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'atendimento_mensagens' AND column_name = 'url_audio';
```

Deve retornar 1 linha com `url_audio` e `text`.

## Depois me avise para fazer o deploy!