# Kanban de Oportunidades

## Visão Geral

Componente de funil de vendas implementado em formato Kanban com **7 colunas** que representam as etapas do ciclo de vida de uma oportunidade. Utiliza **drag-and-drop** para movimentar oportunidades entre colunas, permitindo ao usuário acompanhar e gerenciar todo o funil de vendas de forma visual e intuitiva.

---

## Colunas do Funil

| ID | Título | Cor | Ícone |
|---|---|---|---|
| `recebeu_conta` | Recebeu a Conta | `#5b9bd5` | 📥 |
| `proposta_feita` | Proposta a Ser Feita | `#6ba3d6` | 📝 |
| `proposta_apresentada` | Proposta Apresentada | `#7fb8e8` | 📋 |
| `apresentacao_realizada` | Apresentação Realizada | `#8cc5f0` | 🎤 |
| `contrato_enviado` | Contrato Enviado | `#a3d4ff` | 📤 |
| `contrato_assinado` | Contrato Assinado | `#34d399` | ✅ |
| `comissao_paga` | Comissão Paga | `#4ade80` | 💰 |

---

## Design dos Cards

- **Fundo:** gradiente escuro (`#1e3a5f` → `#162d4a`)
- **Borda esquerda:** cor da coluna correspondente, criando identidade visual por etapa
- **Nome do cliente:** exibido em destaque como elemento principal do card
- **Badge de valor:** valor da oportunidade formatado em reais (R$), visível no card
- **Tags:** informações de origem, prioridade e data de criação exibidas como badges menores

---

## Modal de Detalhes

Tema escuro (`#0c1426`) que exibe:

- **Badge da etapa** com a cor da coluna atual
- **Cliente** com avatar e nome
- **Valor** da oportunidade em destaque
- **Origem** da oportunidade
- **Datas** de criação e atualização
- **Descrição** detalhada da oportunidade
- Permite **edição** dos campos diretamente no modal

---

## Arquivos

| Arquivo | Descrição |
|---|---|
| `kanban-oportunidades.tsx` | Componente principal do Kanban — renderiza colunas, cards e gerencia drag-and-drop |
| `modal-detalhes-oportunidade.tsx` | Modal de detalhes e edição de uma oportunidade existente |
| `nova-oportunidade-modal.tsx` | Modal para criação de uma nova oportunidade |

---

## Funcionalidades

- **Drag-and-drop** entre colunas para movimentar oportunidades no funil
- **Filtro por coluna** — exibir/ocultar etapas específicas
- **Busca** — filtrar oportunidades por nome do cliente
- **Filtro por data** — filtrar oportunidades por período de criação
- **Exclusão no hover** — botão de delete aparece ao passar o mouse sobre um card

---

## Interface Oportunidade

```typescript
interface Oportunidade {
  id: string;
  cliente_nome: string;
  cliente_email?: string;
  cliente_telefone?: string;
  cliente_empresa?: string;
  valor: number;
  origem: string;
  prioridade: 'baixa' | 'media' | 'alta';
  coluna: string;
  descricao?: string;
  data_criacao: string;
  data_atualizacao: string;
  responsavel?: string;
  notas?: string;
}
```

---

## Tema Escuro

Paleta de cores do componente:

| Elemento | Cor |
|---|---|
| Fundo principal | `#0c1426` |
| Cards | `#14233c` |
| Bordas | `#1c2e4a` |
| Gradiente cards (início) | `#1e3a5f` |
| Gradiente cards (fim) | `#162d4a` |

---

## Cores das Colunas

| Coluna | Cor HEX | Escuro | Claro |
|---|---|---|---|
| Recebeu a Conta | `#5b9bd5` | Variante escura | Variante clara |
| Proposta a Ser Feita | `#6ba3d6` | Variante escura | Variante clara |
| Proposta Apresentada | `#7fb8e8` | Variante escura | Variante clara |
| Apresentação Realizada | `#8cc5f0` | Variante escura | Variante clara |
| Contrato Enviado | `#a3d4ff` | Variante escura | Variante clara |
| Contrato Assinado | `#34d399` | Variante escura | Variante clara |
| Comissão Paga | `#4ade80` | Variante escura | Variante clara |
