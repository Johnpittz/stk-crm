# Painel de Cliente Inline no Atendimento

> **Data:** 12/09/2026
> **Status:** Em implementação

## Objetivo
Expandir o painel direito da tela de atendimento para permitir:
1. Criar cliente a partir de um atendimento cru
2. Selecionar tipo de cliente (GD / RECIEE)
3. Preencher dados do contrato GD ou cadastro RECIEE
4. Validar duplicatas (UC, CPF) antes de salvar

## Arquivos a modificar
- `components/features/atendimento/painel-contato.tsx` — componente principal
- `app/api/clientes/route.ts` — adicionar POST com validação
- `app/api/clientes/check-duplicate/route.ts` — NOVO: endpoint de verificação

## Tarefas

### T1: Endpoint de verificação de duplicatas
- Criar `/api/clientes/check-duplicate/route.ts`
- Aceita `{ field: 'uc' | 'cpf_cnpj', value: string }`
- Retorna `{ exists: boolean, cliente?: any }`

### T2: Expandir painel-contato.tsx
- Adicionar estado `tipoCliente: 'gd' | 'reciee' | null`
- Adicionar botão "Criar cliente" quando não tem `cliente_id`
- Adicionar seção "Tipo de Cliente" com seletor
- Adicionar formulário GD expandível
- Adicionar formulário RECIEE expandível
- Validar duplicatas antes de salvar

### T3: Layout responsivo
- Ajustar largura do painel (320px → 380px)
- Em telas pequenas, colapsar seções
