# Plano — Dashboard novo (por fases)

**Pedido do João (06/10/2026):** dashboard com dimensões de
**tempo de resposta** (quem demora mais: vendedor, time ou produto) e
**um dashboard diferente por perfil** (Gerencial / Gerente / Vendedor).
Dividido em fases — cada fase fecha e entrega valor sozinha.

---

## O que já existe hoje (base do plano)

| Dimensão | Situação |
|---|---|
| Tempo de resposta | **Dado bruto pronto**: `atendimentos` tem `vendedor_id` e as mensagens têm autor + horário (`remetente`/`enviada_por`/`created_at`) — dá para calcular sem migrar nada |
| Vendedor | Pronto (`vendedor_id` no atendimento e na oportunidade) |
| Time (equipe) | Coluna `equipe_id` existe no perfil, mas a tabela **`equipes` está VAZIA** — precisa cadastrar |
| Produto | Tabela **`produtos` existe e está VAZIA**; oportunidade hoje só tem `tipo` genérico, sem produto vinculado |
| Perfis/Cargos | Prontos: admin, diretor, gerente_comercial, vendedor |

---

## Fases

### Fase 1 — Medição (fundação)
- Definir e implementar a **regra de tempo de resposta** (ver decisões abaixo)
- Cálculo por atendimento: 1ª resposta do vendedor, médias do dia/período
- Primeiro indicador no Dashboard atual: **card "Tempo de Resposta"** (média geral + hoje)
- **Entrega:** começa a aparecer o número — mesmo sem corte por vendedor/time

### Fase 2 — Dimensões VENDEDOR e TIME
- **Ranking de vendedores** por tempo de resposta (do mais lento ao mais rápido), com filtro de período
- Média **por TIME** (agrupando os vendedores pela equipe)
- Pré-requisito dele: **cadastrar as equipes** e vincular cada vendedor
  (tabela hoje vazia — cadastro manual na tela ou importação que eu faço se mandar a lista)

### Fase 3 — Dimensão PRODUTO
- Tela de **cadastro de produtos** (Configurações) e popular a tabela (hoje vazia)
- Vincular produto à **Oportunidade** (dropdown deixa de ser genérico)
- Dashboard: tempos e vendas **por produto**
- **Entrega:** "qual produto responde/vende melhor"

### Fase 4 — Um dashboard por PERFIL
- **Gerencial** (admin/diretor): visão completa — times, vendedores, produtos, funil
- **Gerente** (gerente_comercial): só os vendedores dos seus times
- **Vendedor**: só ele — seus tempos, seus atendimentos, suas oportunidades
- Filtro aplicado **no servidor** pelo cargo (padrão já usado nas rotas do sistema):
  ninguém enxerga dado que não é seu
- **Entrega:** cada pessoa abre o Dashboard e vê só o mundo dela

### Fase 5 (opcional) — Metas e alertas
- Meta de tempo de resposta (ex.: responder em até 5 minutos)
- Aviso quando vendedor/time estourar a meta; histórico evolutivo

---

## Decisões — RESOLVIDAS em 06/10/2026

1. **Resposta:** 1ª resposta do vendedor, **só em horário comercial**
   (seg–sex 08:00–18:00, Brasília) ✅ implementado na Fase 1.
2. **Times (teste):** **Time Lobo = STK-1** e **Time Águia = STK-3**
   (STK-2 está FAILED/QR). Linhas criadas em `equipes`; mapa
   número→time em `lib/dashboard/equipes.ts` — Fase 2 agrupa por aí.
3. **Produtos:** GD, RECIEE, ELETROPOSTO, SIGMA SOLAR —
   semeados na tabela `produtos` (ativos).
4. **Perfis:** admin/diretor = Gerencial · gerente_comercial = Gerente ·
   vendedor = Vendedor ✅.
5. **Início:** Fase 1 — **CONCLUÍDA em 06/10** (card no Dashboard,
   rota e cálculo; 11 testes).

### Ainda pendente (era "decisões")
- (nada) — próximo passo: **Fase 2** (ranking por vendedor + média por time)

<details><summary>Registro original das perguntas</summary>

### Decisões que precisam do João (regras de negócio)

1. **O que conta como "responder"?** (Sugestão: 1ª resposta do vendedor após
   mensagem do cliente; contar só em horário comercial seg–sex 08–18,
   igual o chatbot — ou 24/7?)
2. **Times:** quais equipes existem? (tabela vazia — me manda a lista com os
   vendedores de cada uma que eu cadastro)
3. **Produto:** o que é "produto" aqui — GD, RECIEE, leilão, outros? E
   populamos a partir de onde (lista/planilha)?
4. **Mapeamento dos perfis:** confirmar — admin/diretor = Gerencial,
   gerente_comercial = Gerente, vendedor = Vendedor?
5. **Por qual fase começar** (sugestão: Fase 1)

</details>

---

## Pendências conhecidas das fases
- Fase 2 trava sem as **equipes** cadastradas
- Fase 3 trava sem os **produtos** cadastrados
- Fase 4 depende de 2 e 3 para as dimensões completas (mas pode entrar antes
  já filtrando por vendedor)
