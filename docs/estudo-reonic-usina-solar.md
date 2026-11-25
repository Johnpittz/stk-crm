# ESTUDO — Demo da Reonic → ideia para a área de USINA SOLAR do STK CRM

> **Data:** 25/11/2026 · **Fonte:** vídeo local `Mini Demo Mi.mp4` (15 min, gravação de uma call de
> demonstração da Reonic em 18/09, em português) — analisado por transcrição de áudio +26 frames.
> **Reonic** é um software alemão (30.000+ usuários) de "vender e instalar sistemas fotovoltaicos".
> **Este doc é estudo/ideia, não plano de implementação.** Pendência: decisões do João no fim do doc.

---

## 1. O que a Reonic faz (mapa do funil pela ordem do vídeo)

### A. Captação automática (o "topo" — o que mais chama atenção)
1. **Landing page pública**: "Saiba quanto você pode economizar com energia solar" → o lead
   informa **endereço (mapa), gasto mensal com a conta, nº de carros elétricos** → em ~1 minuto
   gera um **relatório personalizado** com kits, economia, payback e CO₂, **configurado sozinho**
   (painéis + inversores adequados ao consumo). Depois pede cadastro e envia o link.
2. **Mini plataforma de landing pages** dentro do CRM (o vendedor monta em minutos).
3. **Leitura/apioamento automático do telhado por IA** no mesmo fluxo: quantas águas, material do
   telhado, andares, área útil, **quantas placas cabem** — antes mesmo do vendedor falar.
4. **Painel de "novos leads" na home**, com **pontuação de lead automática** (ex.: 87%, 92%) e
   "dica do dia" orientando o vendedor. Tem também **importação de leads** em massa.
5. **Assistente no WhatsApp**: o vendedor manda mensagem/áudio no WhatsApp e a IA **cria contato,
   tarefa ou gera a proposta em PDF em <1 min** (ideal 15 s). (O próprio vendedor falando: "eu
   tava conversando com um prospect, ele me pediu uma proposta e em seguida eu coloquei dentro do
   sistema".)

### B. Qualificação e dados (o lead vira projeto)
6. **Leitura automática da conta de energia por IA**: concessionária, tipo de UC (B1 residencial),
   tipo de ligação (bifásico), tarifa TE+TUSD ANEEL, contribuição de iluminação pública, consumo —
   tudo com selo "Verificado" e botão **"Solicitar correção"**.
7. **Perfil de consumo por cliente**: horário de pico, tipo de uso (residência, panificadora que
   gasta mais das 8h às 18h), perfil horário → permite dimensionar melhor.
8. **Checklist de homologação por concessionária** (campos de texto e foto, muda conforme a
   distribuidora) + **app do instalador** para subir as fotos na visita técnica.

### C. Dimensionamento/estudo (o coração)
9. **Objetivo do cliente em3 cartões**: "Zerar a conta" (meta 50–109%), "Acumular créditos"
   (110–129%), "Maximizar geração/fora da rede" (130–200%) + slider Econômico ↔ Equilibrado ↔
   Geração máx. → **o nº de painéis é recalculado sozinho**.
10. **IA recomenda o pacote** ("nenhum pacote atende sua meta → IA sugere 23× CHSM72M-HC-525 =
    12,08 kWp") ou o vendedor **monta pacote personalizado** buscando num **catálogo de ~200 mil
    componentes** (painéis com marca/Wp/datasheet, inversores, microinversores, baterias) com
    ordenação por custo-benefício/produção.
11. **Resumo "Sistema calculado" sempre visível**: potência (kWp), geração (kWh/mês), consumo
    (kWh/mês), **"cobre 102%"**, investimento.
12. **Projeto 3D com sombreamento** (o "show"):9 fontes de imagem (Google Maps/Earth/Solar, Bing,
    Apple, Mapbox, drone sobreposto, fotogrametria, geração por IA, Google HD); marcar o telhado →
    medidas; **caminho do sol por horário e mês + mapa de calor**, árvore com medidas (altura,
    copa, tronco) → **% de sol no ano e perda por sombra** → decide onde instalar.
13. **Passo a passo em9 etapas no planejamento**: 1 Solar → 2 Telhado (3D) → 3 Inversor →
    4 Armazenamento/bateria (autonomia: 6h→2 baterias; 24h off-grid→8; 32h→10) → 5 Wallbox →
    6 Extras (cabo, mão de obra) → 7 Pagamento (financiamento parceiro: juros, carência) →
    8 Resultados (eficiência, produção × consumo, fluxo) → 9 Revisão.
14. **Preço e margem**: valor do kit pode ser digitado à mão (diferença vira "ajuste de preço
    oculto") + **margens internas "nunca discriminadas ao cliente"** + opções de pagamento
    (à vista/financiado).

### D. Proposta e fechamento
15. **Proposta em PDF** com validade (ex.: 60 dias) + **link público com logo e cor da empresa**
    que o cliente abre: **3D girável, caminho do sol, lista de peças, produção mensal, economia,
    payback**.
16. **Aceite + assinatura digital dentro da plataforma** (assinam no tablet/celular), com status
    "Assinatura pendente" → "Assinado/Vendido".
17. **Kanban de propostas** com colunas: Entrar em contato → Aguardando feedback → Proposta
    enviada → **Ganhos (contrato assinado)** → **Perdidos**; **R$ somado por coluna**, etiquetas
    (Muito urgente, Expirado, +200 Módulos...), filtros por fonte/status/assinatura.
18. **Fluxo do projeto em wizard de7 etapas**: 1 Informações do lead → 2 Pré-qualificação →
    3 Consultoria → 4 Planejamento → 5 Programação → 6 Livro de trabalho →
    7 Documentação do local de construção (com **validação: "1 campo obrigatório ausente"** e
    10 slots de foto: transformador, ramal, fachada, número da casa, local dos módulos, local do
    inversor, quadro de distribuição...).

### E. Obra, pós-venda e gestão
19. **Portal do cliente** (link): "Visão geral do seu projeto" com checklist de **6 etapas
    (3/6 completo)**: Análise → Visita técnica → Pedido do kit → Kit recebido → Homologação →
    Instalação agendada; abas: Minha estimativa de custos, Acompanhamento da instalação,
    Meus documentos, Solicitações de arquivos, Meus compromissos.
20. **Mudou de etapa → e-mail automático pro cliente**; checklist trava a próxima etapa se não
    for assinado; **ordem de serviço** em imagem/PDF/link; calendário + tarefas integrados
    (tudo vira tarefa; atribuir tarefa → notificação no app do vendedor).
21. **App do instalador com check-in/check-out** na obra (gestão de jornada) e uploads de fotos
    na hora.
22. **Painel de controle**: valor total em vendas, nº de propostas assinadas, **taxa de
    conversão**, tempo até enviar a proposta (12 h) e até a assinatura (7 h), qualidade do lead,
    comparar mês × mês, diário/semanal/mensal/anual.

---

## 2. O que o STK CRM JÁ TEM (ancoragem real — nada de inventar)

| Área | O que existe hoje | Onde |
|---|---|---|
| Cadastro de usina | Checkbox "Tem Usina Solar" = SIM abre o form (CRI, nome, potência kWp) gravando JSON em `clientes.usina` (formato AXS) | `components/features/clientes/form-usina-solar.tsx` |
| Linhas de negócio | Linha **"usina" (Usina Própria)** com status (Em estudo/Em projeto/...), potência kWp, área + linha **"sigma" (monitoramento de usinas)** | `lib/clientes/linhas.ts` |
| Pasta do cliente | Abas **Mercado Livre** e **Usina Própria** com CRUD de linhas | `app/(dashboard)/clientes/[clienteId]/page.tsx` |
| IA de fatura | Analisa a conta e **identifica "Usina Própria"** (sempre "avaliar — exige estudo") e "Sigma Solar" (só se UC geradora = consumidora) | `lib/ia/regras-produtos.ts` |
| Captação | Chatbot WhatsApp com IA + **scoring de lead**, campanhas e disparos em massa | módulo Marketing |
| Funil | Kanban de oportunidades, etapa "recebeu_conta", pós-vendas (follow-up/suporte/acompanhamento) | módulos CRM/Pós-vendas |
| Propostas | **Não existe** geração de proposta/dimensionamento (as "linhas" só registram o negócio) | — |

**Resumo do gap:** hoje o STK **registra** que o cliente tem usina e **detecta** pela fatura que ele
merece um estudo — mas **não calcula, não dimensiona e não gera proposta**. A Reonic faz exatamente
essa ponte de ponta a ponta.

---

## 3. Ideia: o que trazer para o STK (em3 fases)

> Princípio: reaproveitar o que já existe (IA da fatura, chatbot, kanban, pasta do cliente) e
> **não** copiar o mais caro (3D/fotogrametria, app do instalador, assinatura digital) no começo.

### Fase 1 — "Estudo de usina em minutos" (o núcleo; dá para fazer tudo no nosso lado)
- **Tela "Estudo de usina"** dentro da pasta do cliente: entrada = consumo (kWh/mês e valor da
  conta — **pré-preenchido pela IA da fatura que já existe**), tarifa da concessionária, opcional
  carro elétrico.
- **Cálculo**: kWp necessário → nº de painéis → inversor → geração estimada (kWh/mês) → área de
  telhado ≈ → economia mensal/anual → **payback** → CO₂. Mostrar "cobre X% do consumo" como a
  Reonic.
- **Catálogo de componentes** (tabela `componentes`: marca, modelo, Wp, preço, tipo) com busca e
  ordenação custo-benefício — começando enxuto (10–30 itens por linha).
- **3 objetivos de meta** (zerar conta / acumular créditos / maximizar) recalculando o dimensionamento.
- **Saída**: **proposta em PDF + link público** (logo/cor STK) com o estudo, e botão que
  **cria a oportunidade no kanban** e a linha "usina" da pasta.
- **Esforço:** S–M por bloco; tudo backend/Next puro, sem dependência externa.

### Fase 2 — Captação e fluxo (o "topo" da Reonic)
- **Landing pública "quanto posso economizar"** (endereço + gasto mensal) que cai em **Leads com
  score** (scoring já existe no chatbot) e dispara o estudo automaticamente.
- **Gatilho na IA da fatura**: "identificou usina própria? → botão Gerar estudo" (hoje ela só
  marca "avaliar").
- **Checklist de visita técnica** com upload de fotos (telhado, quadro, conta) na pasta — igual o
  checklist de homologação da Reonic.
- **Assistente no WhatsApp**: "manda o resumo da proposta" pelo chatbot que já temos.

### Fase 3 — Obra e pós-venda da usina
- Etapas do projeto (**vendido → homologação → instalação → usina ligada**) com aviso automático
  pro cliente no WhatsApp (webhook/disparo já existem) e **link de acompanhamento** simples.
- Painel com os indicadores da Reonic aplicados a nós: taxa de conversão, tempo até enviar/assinar
  a proposta, R$ no funil.

### O que NÃO copiar agora (e a alternativa barata)
| Reonic | Por que não (ainda) | Alternativa |
|---|---|---|
| Projeto 3D com fotogrametria/sombreamento | Muito caro (motor 3D, fontes de imagem, APIs pagas) | Imagem do **Google Maps/Earth** embutida (já dá p/ ver o telhado) + fotos do drone/cliente; sombra estimada por regra simples |
| App do instalador + time-tracking | Outro produto, não é o gargalo hoje | Checklist de fotos na web + etapas manuais |
| Assinatura digital | Exige fornecedor/e-sign com validade jurídica | PDF com "aceite" por WhatsApp (registro já sai no histórico) |
| Catálogo de200 mil componentes | Não temos a base | Catálogo próprio curto, importável de planilha |

---

## 4. Decisões tomadas pelo João (25/11 — confirmadas)

1. **Foco:** **(a) vender/instalar para quem QUER gerar** (o funil da Reonic). A linha
   "usina própria/Sigma" (cliente que já tem) segue como está, sem prioridade.
2. **Começo:** **Fase 1 completa — tela de estudo + proposta PDF.**
3. **Preços de componentes:** definir depois — por enquanto **placeholders** (preço digitado
   à mão pelo vendedor, como a própria Reonic permite no "valor do kit").

## 5. Fase 1 — EXECUTADA em25/11 (commit `4276b5d`)

| Item | Status |
|---|---|
|1. Catálogo de componentes | ✅ `CATALOGO_MODULOS`/`CATALOGO_INVERSORES` em `lib/usina/dimensionamento.ts` (placeholder, preço a definir) |
|2. Cálculo TDD | ✅ `lib/usina/dimensionamento.ts` + testes (dimensionamento, economia, payback, CO₂) |
|3. Tela de estudo | ✅ aba **Estudo Usina** na pasta do cliente (`components/features/usina/estudo-usina-tab.tsx`) |
|4. Proposta PDF + funil | ✅ `lib/usina/proposta-pdf.ts` (jspdf) + botão "Enviar para o funil" (POST `/api/oportunidades`) |
|5. Gates | ✅ tsc limpo ·834 testes · build ok · commit `4276b5d` publicado |
|6. Usabilidade no ar | ✅ **10/10 PASS** — `tests/usabilidade/teste_usabilidade_usina.py` (produção, cliques reais, prova no banco, limpeza) · commit `056f33f` |

- **Persistência sem migration:** o estudo grava na coluna `clientes.usina` (JSON existente) como
  `{CRI, usina, potencia, estudo}` — `serializarUsina` também foi corrigido para preservar o
  estudo quando alguém edita os dados da usina (página de edição).
- **Pendente:** teste de usabilidade com cliques reais no ar (prática do projeto).

## 5bis. Plano original da Fase 1 (referência)

1. Migration: tabela de **catálogo de componentes** (marca, modelo, Wp/kWh, preço, tipo) + seed de exemplo com preço placeholder.
2. `lib/usina/` **cálculo puro com testes TDD**: dimensionamento (meta → kWp → nº de painéis →
   geração → cobre % → economia → payback → CO₂).
3. **Tela "Estudo de usina"** na pasta do cliente (aba Usina Própria) consumindo a lib.
4. **Proposta**: página pública por link com impressão/PDF + botão "criar oportunidade" no kanban.
5. Gates: `npm test` + `tsc --noEmit` + build; deploy só depois de verde.
