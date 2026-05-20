# Auditoria de Segurança — CRM ROMA

**Data da revisão:** Maio de 2026  
**Responsável pela revisão:** Equipe de Desenvolvimento  
**Status:** Em andamento — Fase 1 ✅ Concluída | Fase 2 ✅ Concluída | Fase 3 🟡 Pendente

---

## 1. Para que serve este documento?

Este documento foi criado para que **qualquer pessoa** — técnica ou não — possa entender os riscos de segurança encontrados no CRM ROMA e acompanhar as correções.

Pensamos em segurança como a segurança de uma loja física:
- **Autenticação** = a fechadura da porta (só quem tem a chave entra)
- **Autorização** = o que cada pessoa pode fazer dentro da loja (o caixa não entra no depósito)
- **Dados expostos** = deixar a gaveta do dinheiro aberta
- **API** = os correios que entregam informações entre o sistema e os usuários

---

## 2. Glossário simples

| Termo | Significado simples |
|---|---|
| **API** | O "correio" do sistema. Transporta informações entre o aplicativo e o banco de dados. |
| **Token / JWT** | A "chave digital" que prova quem você é. Funciona como um crachá de identificação. |
| **Service Role** | A "chave mestra" do banco de dados. Quem usa pode ver e alterar **tudo**, sem limites. |
| **RLS** | *Row Level Security*. É como ter divisórias no escritório: cada pessoa só vê o que é dela. |
| **Endpoint** | Um "ponto de acesso" do sistema. Exemplo: a tela de login é um endpoint, a busca de leads é outro. |
| **Webhook** | Um "aviso automático" que outro sistema manda para o nosso. Exemplo: quando o Millennium registra uma venda, avisa o CRM. |
| **Injeção** | Quando alguém engana o sistema colocando comandos maliciosos onde deveria ir texto normal. |
| **XSS** | Quando um hacker coloca código malicioso em um campo de texto que outras pessoas vão ver. |
| **Rate Limiting** | Limitar quantas vezes alguém pode bater na porta do sistema em um curto espaço de tempo. |

---

## 3. Resumo executivo para gestão

> **Em uma frase:** O CRM ROMA tem portas abertas que deveriam estar trancadas, e algumas pessoas podem fazer coisas que não deveriam poder fazer.

### O que está em risco?

| Risco | O que pode acontecer |
|---|---|
| Qualquer pessoa criar um usuário no sistema | Um concorrente ou hacker pode criar login e acessar todos os dados |
| Qualquer pessoa criar atendimentos falsos | Alguém pode poluir o sistema com informações falsas ou spam |
| Qualquer pessoa consultar CNPJs pela nossa conta | Pode esgotar nossa cota da API e gerar custos inesperados |
| Vendedor ver vendas de outros vendedores | Quebra de privacidade e possível conflito na equipe |
| Vendedor alterar tarefas/oportunidades de colegas | Um vendedor pode sabotar ou interferir no trabalho de outro |
| Webhook do Millennium sem senha | Alguém pode enviar dados falsos (vendas, clientes) direto para nosso banco |
| Senhas escritas direto no código | Se o código vazar, as senhas também vazam |

### Níveis de severidade

- 🔴 **Crítico** — Precisa ser corrigido **nesta semana**. Já expõe dados ou permite acesso indevido.
- 🟠 **Alto** — Precisa ser corrigido **neste mês**. Permite que usuários façam o que não deveriam.
- 🟡 **Médio** — Precisa ser corrigido **em breve**. Dificulta a auditoria e aumenta a superfície de ataque.
- 🟢 **Baixo** — Melhoria recomendada. Não é urgente, mas fortalece o sistema.

---

## 4. Problemas Críticos (🔴)

### 4.1. Qualquer pessoa pode criar um usuário no sistema

**Onde:** Tela de cadastro de usuários (`/api/auth/cadastro`)

**O que acontece hoje:**  
Qualquer pessoa na internet, sem estar logada, pode acessar a URL de cadastro e criar um usuário com acesso de "vendedor". É como se a porta da empresa estivesse aberta e qualquer um pudesse pegar um crachá.

**Por que é perigoso:**  
Um concorrente, ex-funcionário ou pessoa mal-intencionada pode criar um login e acessar leads, clientes, vendas e dados da equipe.

**Como corrigir:**  
- Exigir que quem crie um novo usuário seja um **administrador ou diretor** já logado no sistema
- Adicionar proteção contra robôs (CAPTCHA)
- Limitar quantos cadastros podem ser feitos por minuto

---

### 4.2. Qualquer pessoa pode criar atendimentos falsos

**Onde:** API de atendimentos (`POST /api/atendimentos`)

**O que acontece hoje:**  
O sistema aceita criação de atendimentos sem verificar se quem está enviando está logado. Além disso, usa a "chave mestra" (service role), então pode criar atendimentos em nome de qualquer cliente.

**Por que é perigoso:**  
Alguém pode floodar o sistema com atendimentos falsos, associar clientes errados, ou usar isso para confundir a equipe.

**Como corrigir:**  
- Exigir login para criar atendimentos
- Verificar se o usuário logado tem permissão para criar atendimentos
- Não usar a "chave mestra" para operações normais

---

### 4.3. Qualquer pessoa pode consultar CNPJs usando nossa conta

**Onde:** API de prospecção (`GET /api/prospeccao`)

**O que acontece hoje:**  
A busca de empresas por CNPJ não exige login. Qualquer um pode usar nossa conexão com a API CNPJ Aberto/CNPJota.

**Por que é perigoso:**  
- Pode esgotar nossa cota diária (1.000 consultas no plano gratuito)
- Pode gerar custos se usarmos plano pago
- Alguém pode usar nosso servidor como "escudo" para consultas ilegais

**Como corrigir:**  
- Exigir login para consultar CNPJs
- Limitar quantas consultas cada usuário pode fazer por dia

---

### 4.4. Catálogo de produtos acessível sem login

**Onde:** APIs de produtos (`GET /api/produtos` e `GET /api/produtos/filtros`)

**O que acontece hoje:**  
Qualquer pessoa pode ver todos os produtos, preços (se houver) e filtros do catálogo sem estar logada.

**Por que é perigoso:**  
Dependendo do negócio, o catálogo pode ter informações estratégicas (preços, margens, fornecedores) que não deveriam ser públicas.

**Como corrigir:**  
- Exigir login para acessar produtos
- Se o catálogo deve ser público, criar uma API separada com dados limitados

---

### 4.5. Webhook do Millennium sem senha de segurança

**Onde:** API de webhooks (`POST /api/webhooks/millennium`)

**O que acontece hoje:**  
O Millennium (sistema de gestão) envia avisos para o CRM quando acontece algo (nova venda, novo cliente). A porta que recebe esses avisos deveria ter uma senha, mas se a senha não estiver configurada no servidor, a verificação é pulada.

**Por que é perigoso:**  
Qualquer pessoa que descubra essa URL pode enviar avisos falsos:
- "Nova venda de R$ 100.000" (falsa)
- "Novo cliente cadastrado" (falso)
- Isso polui o banco de dados e pode gerar relatórios errados

**Como corrigir:**  
- Tornar a senha obrigatória (se não tiver senha configurada, recusar todas as mensagens)
- Guardar a senha de forma segura (não no código)
- Registrar de onde veio cada aviso (IP do remetente)

---

### 4.6. Senhas escritas no código-fonte

**Onde:** Scripts auxiliares (`node/millennium_api.js`, `scripts/test-millennium.js`)

**O que acontece hoje:**  
Senhas de acesso ao Millennium estão escritas diretamente nos arquivos de código.

**Por que é perigoso:**  
O código-fonte pode ser compartilhado, copiado ou vazado. Se alguém tiver acesso ao código, tem acesso às senhas também.

**Como corrigir:**  
- Mover todas as senhas para o arquivo `.env` (que não vai para o Git)
- Trocar (rotacionar) as senhas que já foram expostas
- Nunca mais colocar senhas no código

---

## 5. Problemas Altos (🟠)

### 5.1. Busca de leads permite "injeção de comandos"

**Onde:** Tela de busca de leads e produtos

**O que acontece hoje:**  
Quando você digita algo na busca, o sistema coloca esse texto diretamente na consulta ao banco de dados. Se alguém digitar caracteres especiais, pode alterar o comportamento da busca e ver leads que não deveria.

**Exemplo simples:**  
É como se, ao preencher um formulário, você pudesse escrever "mostrar tudo" em vez do seu nome, e o sistema obedecesse.

**Como corrigir:**  
- Limpar o texto digitado antes de usar na busca (permitir só letras, números e espaços)
- Ou fazer buscas separadas por campo, sem juntar tudo em uma string só

---

### 5.2. Vendedor pode alterar dados de outros vendedores

**Onde:** Tarefas, oportunidades, atendimentos e leads

**O que acontece hoje:**  
O sistema verifica se o usuário está logado, mas não verifica se o dado que ele está alterando pertence a ele. Um vendedor pode:
- Fechar uma oportunidade de outro vendedor
- Apagar uma tarefa do colega
- Alterar o status de um lead que não é dele

**Como corrigir:**  
- Antes de alterar, perguntar ao banco: "esta tarefa/oportunidade/lead pertence ao usuário logado?"
- Gestores e diretores podem ter permissão de ver tudo, mas vendedores só devem ver o deles

---

### 5.3. Vendedor pode ver todas as vendas da empresa

**Onde:** Relatório de vendas (`GET /api/vendas`)

**O que acontece hoje:**  
A tela de vendas mostra **todas** as vendas de **todos** os vendedores. Um vendedor comum vê o faturamento do colega.

**Por que é problema:**  
- Quebra de privacidade
- Possível ciúme ou conflito na equipe
- Vendedor pode copiar estratégias de colegas sem permissão

**Como corrigir:**  
- Vendedor comum: ver só suas próprias vendas
- Gestor comercial: ver vendas da sua equipe
- Diretor/Admin: ver tudo

---

### 5.4. Lista de todos os funcionários acessível para qualquer um logado

**Onde:** API de vendedores (`GET /api/vendedores`)

**O que acontece hoje:**  
Qualquer pessoa logada (mesmo um vendedor) pode baixar a lista completa de todos os funcionários: nome, e-mail, cargo e telefone.

**Por que é problema:**  
- Vazamento de dados pessoais da equipe
- Um vendedor descontente pode levar a lista de contatos para um concorrente

**Como corrigir:**  
- Só administradores e diretores devem poder ver a lista completa
- Vendedores só devem ver informações necessárias para o trabalho

---

## 6. Problemas Médios (🟡)

### 6.1. O "porteiro" não olha quem entra nas APIs

**Onde:** Middleware de autenticação (`middleware.ts`)

**O que acontece hoje:**  
O sistema tem um "porteiro" (middleware) que deveria checar o crachá de quem entra, mas ele foi configurado para **não olhar** quem entra pelas portas das APIs. O comentário no código diz "as APIs já se autenticam sozinhas", mas nem todas fazem isso.

**Como corrigir:**  
- Fazer o porteiro olhar todas as portas, inclusive as APIs
- Ou garantir que **cada** API verifique o crachá sozinha

---

### 6.2. Dois sistemas de crachá diferentes

**Onde:** Várias APIs do sistema

**O que acontece hoje:**  
Algumas APIs usam o crachá pelo navegador (cookie), outras exigem que o usuário mostre o crachá a cada requisição (Bearer token). Isso causa confusão e pode fazer com que uma API aceite uma pessoa que outra rejeitaria.

**Como corrigir:**  
- Usar um único sistema de crachá para tudo (preferir o cookie, que é mais seguro)

---

### 6.3. Algumas salas do escritório não têm divisórias (RLS)

**Onde:** Banco de dados Supabase

**O que acontece hoje:**  
O banco de dados tem divisórias (RLS) em algumas tabelas, mas não em todas. Se alguém conseguir a "chave anônima" do sistema (que fica no código do navegador), pode acessar tabelas sem divisória.

**Como corrigir:**  
- Colocar divisórias (RLS) em **todas** as tabelas
- Definir quem pode ver o quê em cada tabela

---

### 6.4. Nenhuma validação nos formulários

**Onde:** Todas as APIs que recebem dados

**O que acontece hoje:**  
Quando alguém envia um formulário, o sistema aceita qualquer coisa. Não verifica se o e-mail é válido, se a data faz sentido, se o número está no formato certo.

**Como corrigir:**  
- Adicionar validação em todos os formulários (biblioteca Zod é recomendada)
- Rejeitar dados estranhos antes de guardar no banco

---

### 6.5. Mensagens de debug visíveis no navegador

**Onde:** Vários componentes do frontend

**O que acontece hoje:**  
O sistema imprime mensagens no console do navegador (F12). Algumas dessas mensagens contêm tokens, dados de sessão e respostas da API.

**Como corrigir:**  
- Remover console.logs do código de produção
- Ou usar um sistema de logs que só grava no servidor

---

## 7. Problemas Baixos (🟢)

### 7.1. Tokens visíveis no navegador

**O que é:**  
O "crachá digital" do usuário fica acessível no navegador. Se houver uma brecha XSS (alguém injetar código malicioso em um campo de texto), o crachá pode ser roubado.

**Como corrigir:**  
- Quando possível, fazer as buscas de dados no servidor (Server Components), não no navegador

### 7.2. Falta cabeçalhos de segurança

**O que é:**  
O servidor não envia instruções de segurança para o navegador (como "não permitir iframe", "forçar HTTPS", etc.).

**Como corrigir:**  
- Adicionar configurações de segurança no `next.config.js`

### 7.3. Versão do Next.js com vulnerabilidade conhecida

**O que é:**  
A versão 14.2.28 do framework usado tem uma falha de segurança já divulgada publicamente.

**Como corrigir:**  
- Atualizar para a versão 14.2.29 ou superior

---

## 8. Plano de Ação por Fases

### Fase 1 — Imediato (esta semana) 🔴

| # | Ação | Responsável | Status |
|---|---|---|---|
| 1 | Proteger cadastro de usuários — exigir admin | | ✅ |
| 2 | Proteger criação de atendimentos — exigir login | | ✅ |
| 3 | Proteger busca de CNPJs — exigir login | | ✅ |
| 4 | Proteger catálogo de produtos — exigir login | | ✅ |
| 5 | Tornar senha do webhook obrigatória | | ✅ |
| 6 | Mover senhas do código para `.env` e trocá-las | | ✅ |

### Fase 2 — Sprint atual (este mês) 🟠

| # | Ação | Responsável | Status |
|---|---|---|---|
| 7 | Corrigir busca de leads/produtos (escapar caracteres curinga SQL) | | ✅ |
| 8 | Vendedor só altera o que é dele (tarefas, oportunidades, leads, atendimentos) | | ✅ |
| 9 | Vendedor só vê suas próprias vendas | | ✅ |
| 10 | Só gestores veem lista completa de funcionários | | ✅ |
| 11 | Atualizar Next.js para versão segura | | 🟡 (pendente — não crítico) |

### Fase 3 — Hardening (próximos 2 meses) 🟡🟢

| # | Ação | Responsável | Status |
|---|---|---|---|
| 12 | Habilitar RLS em todas as tabelas do banco | | ⬜ |
| 13 | Padronizar sistema de autenticação (cookie) | | ⬜ |
| 14 | Adicionar validação em todos os formulários (Zod) | | ⬜ |
| 15 | Limitar requisições por usuário (rate limiting) | | ⬜ |
| 16 | Adicionar cabeçalhos de segurança | | ⬜ |
| 17 | Remover console.logs de produção | | ⬜ |

---

## 9. Checklist de Verificação Futura

Use esta lista antes de cada deploy ou revisão trimestral:

- [ ] Todas as APIs novas exigem autenticação?
- [ ] APIs de modificação (POST, PATCH, DELETE) verificam se o dado pertence ao usuário?
- [ ] Nenhuma senha ou token foi adicionado ao código?
- [ ] As buscas limpam o texto antes de consultar o banco?
- [ ] Webhooks exigem senha secreta?
- [ ] O middleware está protegendo todas as rotas?
- [ ] RLS está habilitado em novas tabelas?
- [ ] Console.logs foram removidos antes do deploy?
- [ ] A versão do framework está atualizada?

---

## 10. Contatos e Responsáveis

| Função | Nome | Contato |
|---|---|---|
| Responsável técnico | | |
| Responsável pela segurança | | |
| Aprovador de mudanças (diretor/admin) | | |
| Revisor de código | | |

---

*Documento criado em Maio de 2026. Próxima revisão programada para: __/__/__*
