# CHANGELOG — STK CRM

> Registro das features implementadas. Últimas 10 entradas.

---

## 1.5.0 — 19/09/2026

### Separadores de Date no Chat
- Adicionado separadores de data entre mensagens de dias diferentes
- Labels: "Hoje", "Ontem", ou data completa (dd/mm/aaaa)
- Visual estilo WhatsApp: pill centralizado com fundo sutil
- Funções `formatarDataSeparador` e `diasDiferentes`

---

## 1.4.0 — 11/09/2026

### Descriptografia de Mídia WhatsApp
- Endpoint `/api/media-download` para descriptografar áudio/imagem
- Player de áudio funcional no chat
- Timestamp original do WhatsApp (messageTimestamp)

### Worker de Disparo
- Worker Python via Supervisor no VPS
- Múltiplas instâncias WhatsApp (STK-1, STK-2, ROMA_2)
- Campos de timing configuráveis

### Segurança
- Validação X-Webhook-Secret
- Rate limiting (180 req/min global)
- LID Resolver para mapear @lid → telefone

---

## 1.3.0 — 06/09/2026

### Chatbot: Gatilho Disparo
- Campo `gatilho` no chatbot_flows: 'todos' | 'disparo'
- Tabela `chatbot_gatilho_numeros`
- Detecção de palavras de parada
- Bloqueio de reativação por 24h

---

## 1.2.0 — 05/09/2026

### Chatbot Inteligente
- Engine de state machine (675 linhas)
- Integração com Gemini 2.5 Flash
- Fluxo pré-configurado: Sustentalski (14 etapas)
- Classificação de leads por scoring (A/B/C/D)

---

## 1.1.0 — 04/09/2026

### Módulo RECIEE
- Upload de faturas PDF com parsing automático
- Análise de cobranças indevidas
- Gerar relatório Excel e proposta comercial PDF

---

## 1.0.0 — 03/09/2026

### Lançamento Inicial
- 4 perfis (CRM, Marketing, Pós-Vendas, Admin)
- Sidebar dinâmica por perfil
- Chat WhatsApp com Evolution API
- Kanban de tarefas
- Gestão de clientes
- Dashboard com métricas reais
