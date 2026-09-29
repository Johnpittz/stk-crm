# PARECER — Por que a criação de card na AXS/ARP "parou de funcionar" (e não parou)

**Data:** 28/09/2026 · **Status:** encerrado, causa raiz confirmada por experimento · **Autor:** agente (Hermes)
**Pergunta que motivou:** "no sábado funcionou, domingo parou — o que mudou na AXS?"

> **Resumo de uma linha: a AXS não mudou nada.** Os três problemas eram nossos e empilhados:
> (1) payload sem o consumo mínimo, (2) sessão única do portal ARP segurando o login e
> (3) o payload da fila aninhado — o robô construía a proposta **vazia**. Corrigido o terceiro,
> o robô criou o card na **1ª tentativa** (28/09 23:51, card `1452248820`).

---

## 1. Evidência decisiva — matriz A/B/C/D (28/09 23:42)

Replay na **mesma sessão**, uma hora só, todos os payloads com os mesmos dados de identidade:

| | payload | HTTP | card | mensalidade |
|---|---|---|---|---|
| **A** | capturado da vitória do domingo (campos `...` de e-mail/nome preenchidos) | **201** | 1452241492 | **4.015,79** — idêntica à do domingo |
| **B** | nosso, o que estava na fila (1000×12, UC limpa, endereço) | **201** | 1452241529 | **767,88** |
| **C** | B só com a UC do card vencedor (`636281132001292`) | **201** | 1452241574 | 767,88 → **UC não influencia** |
| **D** | B só com tipo Comércio/Trifásico/Comercial | **201** | 1452241608 | 712,68 → **tipo não é o bloqueio** |

Os 4 cards de teste foram apagados (`POST /csp/representante/excluir/card/` → 200).
Como **todos** passam, não existe regressão da AXS, mudança de endpoint nem troca de regra deles
entre domingo e hoje. Os cards históricos `1451384681` e `1451381557` também são de **27/09**
(sábado/domingo), lidos direto pela API de consulta.

---

## 2. As três causas-raiz (todas do nosso lado)

### Causa 1 — payload sem o consumo mínimo → HTTP 500
O payload de teste trazia os 12 meses de consumo zerados. A ARP responde
`500 {"retorno": "Erro ao gerar proposta"}` e a fila só registrava
`criar: 500 - Erro ao gerar proposta`.
É a **regra 11** do `docs/axs-fluxo-oficial.md`: para teste usar **1000 kWh em cada um
dos 12 campos**. Com 1000×12 o mesmo payload passa (vira `201`).

### Causa 2 — o ARP é de **sessão única** e não tinha receita de emergência
Qualquer login com sessão aberta devolve `HTTP 203 {"retorno": "sessao ativa",
"chaveVerificaSessao": ...}`; o `criar` sem sessão válida devolve `403 Forbidden`.
Como o robô e o humano disputam **a mesma conta**, a falha parecia aleatória
(alternando `203`, `403` e `#5034` ao longo do dia).

**A receita (tirada do bundle deles, `portal.axsenergia.com.br/arp/assets/index-C0vAx3jo.js`):**

```
1. POST /csp/representante/login/            {email, senha}      → 203 + chaveVerificaSessao
2. POST /csp/representante/sessao/derrubar   {email, chaveValidadeSessao}  → 200 + acessToken
   (atenção ao NOME DO CAMPO: chega "chaveVerificaSessao" e sai "chaveValidadeSessao"
    no corpo do derrubar — foi por isso que 3 tentativas de takeover falharam)
3. DELETE /csp/representante/sessao/excluir  (Bearer)            → 200  = liberar a sessão
4. login de novo                                                    → 200 + token normal
```
- O `derrubar` **já devolve token**: logar logo em seguida volta a dar 203 — usar o token dele.
- Não existe "takeover" por login; quem derruba é o `derrubar`.
- **Hoje o robô não faz isso sozinho** (`criar_da_fila` só avisa "sessão ativa em outro
  dispositivo") — enquanto ele não aprender essa sequência, falhar toda vez que alguém
  estiver no painel. *Decisão pendente (item 1 do rodapé).*

### Causa 3 — payload **aninhado** na fila → proposta vazia → `ERROR #5034` (o que estava mais escondido)
A rota `POST /api/axs/fila` grava a coluna `payload` **plano** (é `dados_proposta`).
Ao reescrever o item em operação eu gravei `{cliente_id, dados_proposta}` — e o
`worker/axs_api.py::criar_da_fila` faz `item.get("payload")` e manda **inteiro** para
`montar_proposta(dados, sessao)`, que lê `dados["consumo_meses"]`, `dados["cep"]`,
`dados["nome"]` **no topo**. Com o envoltório, tudo veio `None` → ARP aceitou o card mas o
gerador interno deles estourou:

```
ERROR #5034: Invalid status code structure ("ERROR <Ens>ErrBPTerminated: Terminating BP
BPCriarCardRepresentante # due to error: ... BP BPGeradorPropostaInd # ...
```

Ao **achatar** o payload, o mesmo robô criou o card na **1ª tentativa**
(`fila_propostas_axs.status = criada`, `axs_card_id = 1452248820`, 23:51:29).

> **Regra permanente:** o que entra em `fila_propostas_axs.payload` é o objeto **plano** de
> `dados_proposta`. Se aparecer `dados_proposta` como chave dentro de `payload`, está errado.
> *Também pendente: a rota deveria validar isso na entrada (item 2 do rodapé).*

---

## 3. O que **não** era a causa (para não investigar de novo)

- ❌ "A AXS mudou endpoint/regra entre domingo e hoje" — matriz A/B/C/D acima.
- ❌ Migrações do banco (084/088/090/091) — a fila e o `payload` nunca foram tocados por elas.
- ❌ Módulo publicado no Vercel — `git diff dc0d987..HEAD` sobre `worker/axs_api.py`,
  `worker/fila_axs.py`, `app/api/axs/*`, `lib/axs/*` está **vazio**; última mudança de fluxo
  ARP = `dc0d987` (27/09 05:28).
- ❌ Fatura: `faturas: []` continua aceitando card `201`; o endpoint de fatura deles quebra
  (`<CLASS DOES NOT EXIST>`), o cálculo vem dos números.
- ❌ Payload do doc do fluxo: ele está **mascarado** (`representante.email`, `pessoaFisica.nomeCompleto`
  e `pessoaFisica.email` = `"..."`), e replay com `"..."` dá `400 Chamada invalida/Campos
  invalidos ou vazios`. **Não é o payload real** — preencher os três campos antes de usar.

---

## 4. Correções de rota (o doc antigo estava errado)

| Ação | Errado no doc antigo | Certo (testado em 28/09) |
|---|---|---|
| Apagar card | `DELETE /csp/representante/excluir/card/{idCard}` → **404** | **`POST /csp/representante/excluir/card/`** com corpo `{"idCard": "…"}` → 200 |
| Sair da sessão | (não documentado) | `DELETE /csp/representante/sessao/excluir` → 200 |
| Derrubar sessão | (não documentado) | `POST /csp/representante/sessao/derrubar` → 200 + token |

Tudo isso já está em `docs/axs-fluxo-oficial.md` §7.

---

## 5. Card de prova do C01

`1452248820` — criado pelo **robô** (fila) em 28/09 23:51:29, lido pela API de consulta
(sem token): **mensalidade 767,88**, economia anual **4.157,54**, consumo médio **1000**,
UC `241500978701257`, EQUATORIAL GO, Casa/apto · Monofásico · Residencial,
"Aguardando Aceite".

---

## 6. Se voltar a falhar assim — ordem do diagnóstico

1. Ler `erro` da linha em `fila_propostas_axs` **completo** (não o trecho do log):
   `203`/`403` → sessão (causa 2); `500 Erro ao gerar proposta` → payload/dados (causa 1);
   `ERROR #5034` → payload aninhado/vazio (causa 3).
2. Conferir o formato: `payload` plano, `consumo_meses` com 12 valores ≥ 1000,
   `uc_instalacao` sem pontuação, `cep` com dígito verificador conferido.
3. Só então mexer em código.

## 7. Decisões pendentes do João

1. Programar o robô para **se auto-liberar** no 203 (sequência do §2) — TDD.
2. **Validar na rota** consumo ≥ 1000, UC e CEP antes de enfileirar (hoje aceita payload
   incompleto e a falha só aparece na AXS).
3. Apagar os cards de teste antigos `1451381557` e `1451384681`? (o `1452248820` é a prova do C01).

## 8. Scripts de apoio (em `/app/stk-worker/`)

`probe_forca.py` (sequência de sessão), `probe_matriz.py` (A/B/C/D acima),
`probe_A2.py` (replay do payload da vitória), `probe_sessao.py`, `probe_criar.py`,
`probe_vitoria.py`. Todos leem a senha do env — **nunca imprimem token/senha**.
