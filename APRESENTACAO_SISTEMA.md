# STK CRM — Documento de Apresentação

> Sistema de Gestão Comercial com Integração WhatsApp  
> Versão: Setembro 2026

---

## O que é o STK CRM?

O **STK CRM** é um sistema feito sob medida para gerenciar todo o ciclo de vendas de energia solar e RECIEE. Ele conecta **WhatsApp**, **cadastro de clientes** e **controle de vendas** em um único lugar, de forma que o vendedor não precise trocar entre planilhas, WhatsApp e outros sistemas.

**Resumindo:** Quando um cliente manda uma mensagem no WhatsApp, o vendedor já vê tudo sobre ele — dados pessoais, propostas anteriores, contas de luz, conversas — tudo na mesma tela.

---

## Os 3 Módulos Principais

### 1. 👥 CLIENTES — A "Pasta" do Cliente

Cada cliente tem uma **pasta completa** com tudo que foi feito com ele. Quando o vendedor clica num cliente, ele vê 5 abas:

| Aba | O que mostra |
|-----|-------------|
| **Dados** | Nome, telefone, CPF/CNPJ, endereço, concessionária, classe tarifária, consumo mensal (gráfico de 12 meses) |
| **GD** | Todas as propostas de Geração Distribuída (solar) — incluindo as feitas pela plataforma AXS |
| **RECIEE** | Contas de luz que o cliente mandou, com análise automática de cobranças indevidas |
| **Atendimentos** | Histórico de todas as conversas WhatsApp com o cliente |
| **Oportunidades** | Todas as oportunidades de venda vinculadas ao cliente |

**Por que isso é importante:**
- Antes, cada informação ficava em um lugar diferente. Agora, tudo está na pasta do cliente.
- O vendedor vê o histórico completo sem precisar perguntar pro cliente de novo.
- Se o cliente mandou 120 contas de luz para análise RECIEE, todas ficam salvas.

---

### 2. 📋 KANBAN DE OPORTUNIDADES — O Funil de Vendas

O Kanban é um **quadro visual** que mostra onde cada venda está. Funciona como um funil — cada venda passa por etapas até ser fechada:

```
📥 Recebeu a Conta
    ↓
📝 Proposta a Fazer
    ↓
📋 Proposta Apresentada
    ↓
📤 Contrato Enviado
    ↓
✅ Contrato Assinado
    ↓
💰 Comissão Paga
```

**Como funciona na prática:**
1. Cliente manda conta de luz no WhatsApp
2. O sistema detecta e sugere criar uma oportunidade
3. Vendedor arrasta a oportunidade pelo quadro conforme vai avançando
4. Gestor vê tudo em tempo real — quantas vendas estão em cada etapa

**Cada vendedor só vê as suas oportunidades.** Gestores veem todas.

---

### 3. 💬 ATENDIMENTO — WhatsApp Integrado

O módulo de atendimento é onde o vendedor **conversa com os clientes** diretamente pelo sistema, sem precisar abrir o WhatsApp separado.

**O que o atendimento faz:**

- **3 colunas no estilo WhatsApp:** lista de conversas à esquerda, chat no meio, dados do cliente à direita
- **Múltiplos números:** O sistema gerencia 3 números de WhatsApp ao mesmo tempo (ROMA_2, STK-1, STK-2)
- **Chatbot inteligente:** Um assistente virtual pode responder Automaticamente as primeiras mensagens do cliente, fazendo perguntas de qualificação (nome, CPF, estado, tipo de imóvel, etc.)
- **Detecção de conta de luz:** Quando o cliente manda uma imagem ou PDF, o sistema sugere criar uma oportunidade automaticamente
- **Painel do contato:** Do lado direito, o vendedor vê os dados do cliente, pode criar propostas GD ou RECIEE sem sair da conversa
- **Etiquetas:** O vendedor pode classificar conversas (ex: "Prioridade", "Aguardando retorno")

**Detecção automática de conta de luz:**
1. Cliente manda foto/PDF da conta
2. Sistema mostra um banner: "Possível conta de energia detectada"
3. Vendedor clica em "Criar Oportunidade" ou "Dispensar"
4. Se dispensar, fica registrado que a conta foi analisada e dispensada

---

## Como Tudo se Conecta

```
Cliente manda WhatsApp
        ↓
   Atendimento recebe
        ↓
   Chatbot qualifica (opcional)
        ↓
   Vendedor assume a conversa
        ↓
   Cliente manda conta de luz
        ↓
   Sistema detecta → Sugere Oportunidade
        ↓
   Oportunidade aparece no Kanban
        ↓
   Vendedor trabalha a venda (proposta → contrato → assinatura)
        ↓
   Comissão paga → Venda fechada
        ↓
   Tudo fica salvo na pasta do cliente
```

---

## Outros Módulos do Sistema

| Módulo | O que faz |
|--------|-----------|
| **Marketing** | Campanhas de WhatsApp em massa, gestão de leads, promoções |
| **Chatbot** | Assistente virtual com fluxos personalizáveis (usa IA Gemini) |
| **RECIEE** | Análise automática de contas de luz para recuperar cobranças indevidas |
| **Pós-Vendas** | Follow-up, pesquisa de satisfação, suporte, acompanhamento |
| **Equipes** | Gestão de vendedores e métricas por equipe |
| **Produtos** | Catálogo de produtos com preços e filtros |
| **Vendas** | Registro e acompanhamento de vendas fechadas |
| **Configurações** | Perfil, aparência, notificações, segurança |

---

## Tecnologia por Baixo dos Panos

| Componente | Tecnologia |
|-----------|-----------|
| **Sistema** | Next.js 14 (hospedado na Vercel, plano gratuito) |
| **Banco de dados** | Supabase (PostgreSQL, plano gratuito) |
| **WhatsApp** | Evolution API (rodando num servidor próprio) |
| **Chatbot** | Google Gemini 2.5 Flash (IA) |
| **Análise de contas** | Tesseract.js (OCR gratuito, roda no navegador) |
| **Propostas AXS** | Playwright (automação de navegador no servidor) |
| **Disparos em massa** | Worker Python (servidor dedicado) |

**Custo de infraestrutura:** Praticamente zero — tudo roda em planos gratuitos ou servidor próprio.

---

## Números do Sistema

- **32 páginas** de interface
- **59 componentes** reutilizáveis
- **63 endpoints** de API
- **3 instâncias** de WhatsApp conectadas
- **7 etapas** no funil de vendas
- **5 abas** na pasta de cada cliente
- **45 migrações** de banco de dados

---

## Resumo para a Apresentação

> "O STK CRM é um sistema que conecta WhatsApp, cadastro de clientes e controle de vendas em um só lugar. Quando um cliente manda mensagem, o vendedor já vê tudo sobre ele. Quando ele manda uma conta de luz, o sistema detecta e sugere criar uma oportunidade de venda. Tudo fica organizado num quadro visual (Kanban) que mostra onde cada venda está. E toda a informação fica salva na pasta do cliente, sem perda de dados."

---

*Documento gerado em Setembro 2026 — STK Tecnologia*
