-- Adicionar coluna fluxo_mensagens para sequência personalizada (texto → imagem → texto)
-- Cada passo: { type: 'text', content: '...' } ou { type: 'image', url: '...' }
ALTER TABLE bulk_campaigns ADD COLUMN IF NOT EXISTS fluxo_mensagens JSONB;

COMMENT ON COLUMN bulk_campaigns.fluxo_mensagens IS 'Sequência de passos: [{ type: "text", content: "..." }, { type: "image", url: "..." }]';
