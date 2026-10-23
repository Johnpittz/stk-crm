# RECIEE — motor de validação de faturas (dentro do STK-CRM)

> O que este doc é: o manual do módulo `lib/reciee/`. Ele existe porque o RECIEE
> no STK-CRM só **extraía** dados da conta; agora também **prova** a conta e gera
> o email pronto para a distribuidora.

## 1. Por que

A IA (`lib/ia/analisar-fatura.ts`) lê foto/PDF e devolve UC, consumo, valor e
tributos. Isso é entrada, não conclusão. A entrega combinada é: **o que foi
cobrado × o que deveria ser cobrado × quanto está em disputa**, com o email já
escrito para a concessionária.

Calibração: auditoria das **29 faturas da UC 000266515901272** (Equatorial Goiás,
B3), NOV/2023 → MAI/2026, R$ 152.470,68. Resultado: **aritmética fecha 100%**
(leitura, quantidade×tarifa, ICMS, PIS/COFINS, soma) e 8 achados estruturais
(faturas faltantes, datas impressas erradas, troca de medidor, nota substituída).
Os testes do módulo usam os números reais dessa auditoria.

## 2. Peças

| Arquivo | Papel |
|---|---|
| `referencias.ts` | Tabelas **por período**: bandeira ANEEL (141 meses, 2015-01→2026-09, R$/MWh), ICMS-GO (17% até 31/03/2024, 19% depois), PIS/COFINS efetivos (0,3918% e 1,822%), tarifas homologadas da Equatorial GO B3 por vigência |
| `tipos.ts` | Contrato da fatura e do achado |
| `indices.ts` | Códigos do catálogo que o motor emite + **guarda da seção 8** |
| `validar.ts` | `validarFatura()` e `validarSequencia()` — a prova |
| `adaptadores.ts` | Linha de `faturas_reciee` → fatura do motor (o que não existe vira `null` e **não é avaliado**) |
| `email.ts` | `montarEmailConcessionaria()` — texto pronto por cliente |
| `*.test.ts` | 26 testes |

## 3. O que é verificado (e com qual tolerância)

| # | Verificação | Código emitido | Tolerância |
|---|---|---|---|
| 1 | (leitura atual − anterior) × fator K = consumo | `RECIEE-162` | 1 kWh |
| 2 | quantidade × tarifa com tributos = valor cobrado | `MOTOR-LINHA` | R$ 0,01 |
| 3 | tarifa sem tributos × tarifa homologada do período | `RECIEE-058` (1 vigência) / `RECIEE-040` (troca no meio do ciclo, ponderada pelos dias) | R$ 0,001/kWh |
| 4 | alíquota de ICMS de Goiás na data do ciclo | `RECIEE-050` | 0,01 p.p. |
| 5 | base de PIS/COFINS = base de ICMS − ICMS (Tema 69) | `RECIEE-T69-001` | R$ 0,05 |
| 6 | PIS/COFINS = base × alíquota **efetiva** sancionada | `RECIEE-016` | 0,05% da base |
| 7 | linhas + itens = total impresso | `MOTOR-SOMA` | R$ 0,01 |
| 8 | dias impressos × período real da fatura | `RECIEE-051` | 1 dia |
| 9 | bandeira cobrada × oficial rateada | `RECIEE-011` | R$ 2,00 |
| 10 | fatura anterior encosta na seguinte (e nomeia o mês que falta) | `MOTOR-FURO` / `RECIEE-077` / `RECIEE-134` | — |

**Rateio da bandeira (o modelo validado):** os dias do mês FINAL carregam a
bandeira daquele mês e o resto, a do mês anterior:
`consumo × (diasFim × vFim + (dias − diasFim) × vAnterior) / 1000 / dias`.
Fechou centavo a centavo em 13 das 16 faturas com bandeira; as outras ficaram em
R$ 2–4 de arredondamento.

**Troca de vigência no meio do ciclo:** média ponderada pelos dias inclusivos
(ex.: OUT/2024, 29 dias na tarifa antiga + 2 na nova = 0,712979 contra 0,712983
cobrado).

**Sem referência, não há acusação:** tabela tarifária inexistente para
distribuidora/subgrupo vira achado `info` (`MOTOR-TARIFA-REF`), nunca crítica.

**Guarda da seção 8:** qualquer índice de continuidade/ressarcimento sugerido
sai como `info` com a frase obrigatória — *"não identificável conclusivamente
apenas pela fatura"* — e nunca como cobrança.

## 4. Como usar

```ts
import { validarFatura, validarSequencia } from "@/lib/reciee/validar";
import { montarEmailConcessionaria } from "@/lib/reciee/email";
import { mapearFaturaDb } from "@/lib/reciee/adaptadores";

const faturas = linhasDoBanco.map(mapearFaturaDb);
const achados = faturas.flatMap(validarFatura).concat(validarSequencia(faturas));
const email = montarEmailConcessionaria({ cliente, faturas, achados });
```

Rota pronta: **`POST /api/reciee/clientes/[clienteId]/validar`** — lê as
`faturas_reciee`, roda o motor, **grava os achados em `analises_reciee`**
(reaproveita a tabela que já existe, sem migration) e devolve
`{ achados, resumo, email }`.

## 5. Limites conhecidos (o que ainda NÃO roda sozinho)

1. **A tabela `faturas_reciee` guarda pouco**: tem consumo, tarifa, tributos,
   bandeira e total, mas **não** guarda período (início/fim/dias), leituras nem
   itens financeiros. Enquanto a extração não gravar esses campos, os checks 1,
   8, 9 (rateio) e 10 ficam de fora da rota — o motor já aceita tudo isso, é
   só a coluna existir.
2. **A tarifa sem tributos não é extraída** hoje (só a tarifa com tributos), e
   a comparação com a ANEEL usa a sem tributos → o check 3 fica em aberto até
   a extração trazer os dois campos.
3. **Distribuidoras outras que não a Equatorial GO B3** não têm vigência
   cadastrada → cai no `MOTOR-TARIFA-REF` (informativo). Acrescentar é uma linha
   em `TARIFAS_OFICIAIS`.
4. Ainda **não há botão na tela**: a rota existe e é chamável; ligar a tela da
   pasta do cliente é o próximo passo.

## 6. Como estender

- **Novo índice do catálogo:** adicionar o código em `indices.ts` (tema) e o
  achado em `validar.ts`, com teste no `validar.test.ts`.
- **Nova tabela oficial:** acrescentar em `referencias.ts` com a fonte e a data
  do download (dados abertos da ANEEL, 06/10/2026).
- **Outra distribuidora/subgrupo:** nova vigência em `TARIFAS_OFICIAIS`.

## 7. Pendências da mesma entrega

- [ ] Extração passar a gravar `periodo_inicio`, `periodo_fim`, `dias`,
      `leitura_anterior`, `leitura_atual`, `tarifa_sem_tributos` e os itens
      financeiros (migration + prompt de IA) → libera os checks 1, 3, 8, 9, 10
      na rota.
- [ ] Botão "Validar contas / gerar email" na pasta do cliente (`/reciee/[id]`).
- [ ] Incluir a aba "E-mail para a distribuidora" no relatório XLSX
      (`app/api/reciee/clientes/[clienteId]/relatorio`).
