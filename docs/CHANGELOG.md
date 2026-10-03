# CHANGELOG — STK CRM

> Registro das features implementadas. Últimas 10 entradas.

---

## 1.8.1 — 03/10/2026

### IA do atendimento passa à MIMO (Opção A) — fim do `erro_ia`
- Em produção toda pergunta caía no fallback "Deixa comigo..." com motivo
  `erro_ia`: a chamada ao Gemini falhava (chave ausente/inválida na Vercel)
- Novo provedor único `lib/ia-provider.ts`: MIMO (`mimo-v2.6-flash`, API
  OpenAI-compatível) por padrão, Gemini mantido como legado (`IA_PROVIDER`)
- Usado pela base de conhecimento (`ai-assistant`) E pela interpretação de
  resposta livre do chatbot (`engine.interpretarRespostaIA` — antes travava
  em `!GEMINI_API_KEY` e caía sempre no match simples)
- Guardrail intacto: falha do modelo continua `erro_ia` → encaminha com registro;
  `[[ENCAMINHAR]]` e `base_vazia` não mudaram
- TDD: 17 testes novos (RED → GREEN), gates **322 vitest + 138 unittest + tsc limpo**
- **Em produção no mesmo dia:** `Prazo` (03:26:49) → resposta da base em **9s**,
  0 notificações de `erro_ia` (toggle IA ligado e desligado pelo João às 03:26/03:27)

### Imagem do disparo deixa de virar arquivo de 422 KB
- Causa provada: a tela gravava o passo com prefixo `data:image/jpeg;base64,`
  (sem subir pro Storage) e o robô mandava isso pra WAHA → decodificação
  corrompida: `fileLength` **432548** (mágica `75ab5a8a`, ≠ JPEG) vs **432533**
  limpo — o WhatsApp mostrava quadro cinza com o ícone de ⬇ 422 KB
- Robô: `limpar_base64()` antes de enviar + `eh_contato()` não envia mais pra
  lixo da lista (`STK-3` virava chatId `553@c.us` e a WAHA dava timeout)
- Tela: `lib/marketing/disparo-fluxo.ts` — imagem **sobe pro Storage** e o passo
  vira `{type:'image', url, mimetype}`; `montarNumbers()` tira a instância da
  lista em massa/avulso (só o remarketing estava corrigido)
- Rota `/api/bulk/campaigns`: o passo agora guarda **também** o `mimetype`
- TDD: 9 testes do worker + 15 vitest novos; **gates: 337 vitest + 147 unittest + tsc**
- **Prova em produção (03:38):** imagem enviada pelo caminho corrigido leu
  `fileLength=432533` (= limpa) na API do WAHA — 1 mensagem de teste ao nº do João

---

## 1.8.0 — 30/09/2026

### Sincronização de mensagens (fora da lista de testes)
- Mensagem enviada por nós (`fromMe`) era arquivada **na conversa errada**: o parser lia os
  campos de remetente (somos nós) em vez de `RecipientAlt` → chat `@lid` apontava para o nosso
  número; 10 mensagens paravam no atendimento do nosso número
- Cartão de contato (vCard) e localização eram descartados como "mensagem vazia"
- Conserto em TDD (5 testes RED → GREEN), commits `4555880` e `66e2d84`
- Histórico reparado: 10 mensagens realocadas + 7 repostas por replay do payload real;
  auditoria final por ID = 0 mensagens fora do CRM

### Badge de número conectado (🔗 STK-x)
- Nunca aparecia: a rota entregava `status` mapeado sem `state` e o helper só aceitava
  `WORKING/STARTED`. Conserto em TDD (`b6f713d`), verificada na lista e no cabeçalho do chat

### Documento de proposta em PDF (Fase 6 / C4)
- Botão "Gerar/Baixar proposta" na pasta do cliente e no modal da oportunidade
- Gatilho automático quando a etapa vira **Contrato Enviado**
- Gravado no Storage privado e registrado na tabela `propostas`

### Robô de fila AXS (Fase 3 / C01)
- Card criado pelo robô pelo caminho oficial (fila → `criar/card`): `1452248820`
- Payload da fila precisa ser **plano** (topo), senão o gerador responde `ERROR #5034`
- Scripts `/app/start-worker.sh` e `/app/stop-worker.sh` (modo ensaio/dry-run)

### Testes de liberação
- 34 itens aprovados + 3 de performance; 0 reprovados após conserto de B11
- Controle vivo: `docs/TESTES-SISTEMA.MD` · HANDOFF · parecer ARP em `docs/PARECER-ARP-28-09-2026.md`
- Entregas em Word: `RESUMO-SIMPLES-como-usar-29-09-2026.docx` (guia de leigo) e
  `relatorio-testes-26-29-set-2026.docx` (relatório técnico)

---

## 1.7.0 — 20/09/2026

### Busca de Contatos WhatsApp via Evolution API
- Modal de busca de contatos com debounce (300ms)
- Verificação de números no WhatsApp
- Criação de atendimento direto da busca
- API routes: `/api/whatsapp/contacts`, `/api/whatsapp/check-number`
- Fallback automático de URL da Evolution API
- Rota de debug `/api/whatsapp/debug`

### Bug Fixes
- EVOLUTION_API_KEY corrompida no build Vercel
- EVOLUTION_INSTANCE estava 'minha-conexao' (inexistente), corrigido para STK-1

### Arquivos modificados
- `lib/evolution-api.ts`
- `app/(dashboard)/atendimento/page.tsx`

### Arquivos criados
- `app/api/whatsapp/contacts/route.ts`
- `app/api/whatsapp/check-number/route.ts`
- `app/api/whatsapp/debug/route.ts`
- `components/features/atendimento/buscar-contatos-whatsapp.tsx`

---

## 1.6.0 — 19/09/2026

### Redesign Cards Kanban Oportunidades + Modal Tema Escuro
- Cards do Kanban redesenhados com gradiente e borda lateral colorida por coluna
- Cards: cliente em destaque (fonte maior/bold), valor em badge verde, tags de origem/prioridade/data
- Cards: botão deletar com backdrop-blur no hover, drag feedback visual melhorado
- Modal de detalhes completamente em tema escuro (bg-[#0c1426])
- Modal: etapa real do funil no badge (substituiu 'Tipo: Pedido | A Fazer')
- Modal: cliente com avatar, valor da venda em destaque, origem como badge colorido
- Modal: todos inputs/selects/botões em tema escuro consistente
- Botão de fechar (X) visível em tema escuro
- Arquivos modificados: kanban-oportunidades.tsx, modal-detalhes-oportunidade.tsx, dialog.tsx

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
