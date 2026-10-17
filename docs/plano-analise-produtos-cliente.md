# PLANO — Análise de Fatura → Tela de Oportunidades + Inserção manual por produto na aba do cliente

Fonte: "lógica dos produtos para o CRM.docx" (17/10/2026 — 3 simulações +
protocolo + 2 fluxogramas).

## Por que o documento ajuda (resposta ao João)

Ele é, na prática, o **dicionário de dados de cada produto**: pra CADA
produto ele diz quais campos ler, qual o limite/gatilho, qual o status e
qual a evidência. A aba do cliente já tem a **mecânica pronta**:

- `cliente_pasta_linhas` (linha + dados JSON) + catálogo `lib/clientes/linhas.ts`
- `TabLinhaSimples` = CRUD manual genérico (já usado em Eletroposto,
  Sigma Solar, BESS e Gestão de Fatura)

Ou falta: (1) completar o catálogo com os produtos que ainda não têm
linha manual (**Mercado Livre, Usina própria, GD por assinatura**), (2)
o campo de status vindo do documento, e (3) a IA alimentar as mesmas
abas. Mesmo modelo de dados serve pro manual e pro automático.

## Gatilhos por produto (do documento — fonte única de verdade)

| Produto | Gatilho / regra | Status típico |
|---|---|---|
| Mercado Livre | Só se NÃO estiver no ACL ("Demanda Livre") | Não recomendar se já está no livre |
| GD por assinatura (Grupo B) | Grupo B + simular economia real | Avaliar |
| GD Grupo A | Grupo A e compatível com contratação existente | Avaliar (nunca automático) |
| Usina solar própria | Sempre "avaliar" — exige estudo | Preliminar |
| BESS | Consumo **na ponta** > 4.000 kWh | Não acionada se total≤4000 ou sem dado de ponta |
| RECIEE | **Média financeira mensal** da UC > R$ 5.000 (não 1 fatura) | Preliminar até apurar média |
| Eletroposto | CNAE principal ∈ {restaurante, hotel, academia, shopping, supermercado} | Pendente até consultar CNPJ |
| Sigma Solar | Evidência de usina própria (UC geradora = UC consumidora) | Inconclusivo sem evidência |

Status padronizados (doc, Etapa 4): `identificada` · `preliminar`
(= pendente de validação) · `nao_acionada` · `inconclusiva`.

Regras **independentes**: uma conta pode gerar vários produtos ao mesmo
time. Faltar dado = pendência, nunca descarte.

---

## Fase A — 🔍 Análise da Fatura vira Tela de Oportunidades

> Decisão do João (17/10): o **botão continua com o mesmo nome**
> ("Análise da Fatura") — só o conteúdo de dentro muda: o modal passa a
> mostrar a tela de oportunidades com status, evidência e pendências.

1. **RED** `lib/ia/regras-produtos.test.ts` — puro:
   `aplicarRegras(dados)` recebe os dados extraídos (grupo, perfil,
   contratação livre, valor fatura, consumo_ponta, consumo_total,
   cnae_principal, energia_injetada, uc_geradora, uc_consumidora) e
   devolve `[{produto, status, motivo, evidencia, pendencia}]`.
   Casos: simulação 1 (Grupo A + Demanda Livre → ML não recomendar,
   BESS fora c/ ponta 1.025, RECIEE preliminar), simulação 2 (B3 →
   GD assinatura/usina/eletroposto preliminar, BESS sem ponta),
   simulação 3 (B2 c/ GD II → Sigma inconclusivo sem UC geradora).
2. **GREEN** `lib/ia/regras-produtos.ts` com os gatilhos da tabela.
3. Rota `/api/clientes/[id]/analise-conta`: depois de extrair, chamar
   `aplicarRegras` e devolver `oportunidades` junto do resumo
   (PCT por arquivo PDF; foto já extrai pela IA visão).
4. UI `analise-conta-modal.tsx` → **Tela de Oportunidades**: lista cada
   produto com status (badge), motivo/evidência e pendência; botão
   **"➕ Criar no funil"** por oportunidade identificada (POST
   /api/oportunidades já existe) e botão "Adicionar na aba do cliente"
   (Fase B).

## Fase B — Inserção MANUAL de cada produto na aba do cliente

1. **RED/GREEN** `lib/clientes/linhas.ts`: novas linhas no catálogo:
   - `mercado_livre` (situacao: Regulado/Livre, ambiente, observações)
   - `usina_propria` (potência kWp, área, status estudo, retorno estimado)
   - em TODA linha produto: campos `status` (Identificada/Preliminar/
     Não acionada/Inconclusiva) e `origem` (Manual/IA) — teste novo.
2. Abas na pasta: criar aba/aba-seção para Mercado Livre e Usina
   própria — com `TabLinhaSimples` (mesmo CRUD já testado).
   **GD não mexe** (decisão do João): é fluxo AXS — clicar no módulo
   inicia o processo AXS e a listagem fica na própria aba.
3. Migração 102 se algum campo novo exigir coluna (esperado: **não** —
   tudo cabe em `cliente_pasta_linhas.dados`).

## Fase C — Ponte IA ↔ manual

- A análise grava cada oportunidade na aba do produto com
  `origem: "IA"` (não duplica: se já existir linha do produto com status
  Identificada/Preliminar, só atualiza evidência).
  GD fica de fora (fluxo AXS intocado).
- Manual continua soberano: o vendedor edita/exclui normalmente.

## Gates (sempre)

TDD RED→GREEN · `npm test` · `npx tsc --noEmit` · `npm run build` local ·
unittest worker · CHANGELOG · commit explícito · teste de usabilidade
com cliques reais + relatório (prática permanente).

## Fora deste plano

- Validação de viabilidade técnica/econômica (fica pra proposta).
- Alterar regras comerciais existentes do worker (RECIEE >5K etc.) —
  o documento só formaliza o que já existe, exceto BESS = ponta
  (confirmar com o João se o worker atual usa total ou ponta).
