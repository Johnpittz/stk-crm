# AXS — como criar proposta de verdade (fluxo ARP)

> **Status: resolvido em 27/09/2026.** Este doc é a fonte de verdade para a Fase 4.
> Quem chegou aqui depois: leia tudo antes de mexer em `worker/axs_api.py`.

---

## 1. Resumo em 3 linhas

A criação de proposta na AXS funciona **por HTTP puro** (sem navegador), mas só pelo
**fluxo ARP** (área do representante), não pelo fluxo público de onboarding que
usávamos. Com o fluxo certo, a AXS **calcula sozinha** mensalidade e economia — foi o
que faltou nas tentativas anteriores (dava `R$ 0,00` e `NaN`).

---

## 2. Os dois fluxos (é aqui que a gente errou)

| | Fluxo de onboarding (o errado) | **Fluxo ARP (o certo)** |
|---|---|---|
| URL do app | `portal.axsenergia.com.br/onboarding/...` | **`portal.axsenergia.com.br/arp/...`** |
| Bundle | `/onboarding/assets/index-B9fgXBnn.js` | **`/arp/assets/index-C0vAx3jo.js`** (4,3 MB) |
| Autenticação | nenhuma | **`Authorization: Bearer <token>`** (login) |
| Criar | `POST /csp/usuario/criar/` | **`POST /csp/representante/criar/card/`** (201) |
| Cálculo | **não existe** → mensalidade fica `R$ 0,00` | **calcula**: mensalidade + economia |
| Fase | trava em "Aguardando cadastro" | flui normalmente |

O fluxo público é o do **link do cliente** (`/onboarding/card/<idCard>`): serve para o
cliente ver/assinar, **não para o representante criar**. Criando por lá, o card nasce
"meio vazio" — é o motivo dos prints com `R$ undefined` / `NaN kWh`.

---

## 3. Autenticação

1. `POST https://iris.axsenergia.com.br/csp/representante/login/` (e-mail + senha)
   → devolve o token, que o app guarda em `localStorage['@ARP-Energia:token']`.
2. Todas as chamadas ARP levam: `Authorization: Bearer <token>` **e** header `tennant: ARP`.
3. Sem token: `401 {"retorno":"Token inválido ou sessão expirada"}`.

Os dados de sessão usados no payload vêm de `localStorage['@ARP-login']`
(`Origem`, `Grupo`, `TipoVendedor`, `CodigoPlano`, gestores etc.).

**Segurança:** a senha ARP fica **no cofre do Hermes** (para o navegador) e **no env do
worker** (para a fila). Nunca em chat, log ou repositório.

---

## 4. O payload que FUNCIONA (capturado ao vivo, 1655 bytes)

`POST /csp/representante/criar/card/` → **201** + `idCard`.

```json
{
  "tipoProposta": "Comércio",
  "tipoPessoa": "PF",
  "telefoneLigacao": "(62) 99999-0000",
  "observacoes": {"temperatura": "", "observacao": "texto livre"},
  "representante": {
    "nome": "MICHELE SANTOS DE ARAUJO",
    "email": "...", "CPF": "643.804.831-34",
    "razao": "SUSTENTALSKI LTDA", "CNPJ": "54.989.732/0001-85",
    "codigoLink": "643.804.831-34", "canal": "INDIRETO",
    "tipo": "Representante Legal", "grupo": "GO",
    "gestor1": "RONALDO JUNIOR", "gestor2": "FABIO COSTA MARTINS DA SILVA",
    "origem": "REGIONAL", "codigoPlano": "50501000090"
  },
  "dadosBancario": {"formaPagamento": "Pix"},
  "endereco": {
    "CEP": "74968-546", "estado": "Goiás", "cidade": "Aparecida de Goiânia",
    "bairro": "Residencial Solar Central Park", "logradouro": "Rua Alsácia",
    "numero": "1000", "complemento": "Quadra 10"
  },
  "pessoaFisica": {
    "nomeCompleto": "...", "CPF": "812.450.379-60", "email": "...",
    "telefone": "(62) 99999-0000", "dataNascimento": "1985-02-01"
  },
  "fatura": {
    "faturas": [], "concessionaria": "EQUATORIAL GO",
    "numeroInstalacao": "636281132001292", "dataVencimentoFatura": 10,
    "classe": "Trifásico", "subClasse": "Comercial",
    "consumoJan": "5271", "consumoFev": "4670", "consumoMar": "4501",
    "consumoAbr": "5078", "consumoMai": "5821", "consumoJun": "4859",
    "consumoJul": "6224", "consumoAgo": "6037", "consumoSet": "6097",
    "consumoOut": "5128", "consumoNov": "4555", "consumoDez": "4026",
    "geracaoPropria": false,
    "gerPropriaJan": "0", "gerPropriaFev": "0", "gerPropriaMar": "0",
    "gerPropriaAbr": "0", "gerPropriaMai": "0", "gerPropriaJun": "0",
    "gerPropriaJul": "0", "gerPropriaAgo": "0", "gerPropriaSet": "0",
    "gerPropriaOut": "0", "gerPropriaNov": "0", "gerPropriaDez": "0"
  },
  "usina": {"CRI": "", "usina": ""}
}
```

Resposta que interessa (o app guarda como "resultado"):
`mensalidade_axs`, `gera_o_anual_contratada_2`, `m_dia_de_consumo`.

---

## 5. As regras "que não falam" (o mapeamento que quebrava tudo)

1. **`classe` ≠ Residencial/Comercial.** `classe` é o **tipo de conexão**:
   `Monofásico` | `Bifásico` | `Trifásico`. E **`subClasse`** é o grupo:
   `Residencial` | `Comercial` | `Industrial` | `Rural` | `Outros`.
   No backend eles caem em `tipoConexao` e `grupoTarifario` — mandar errado faz a
   API devolver `{"mensagem":{"proposta":""}}` e a interface mostrar
   *"Seu cliente não possui consumo suficiente para assinar conosco"* /
   servidor `202 "Consumo mínimo não atingido"`. **Não é consumo, é enum.**
2. **`observacoes` é objeto** (`{"temperatura":"","observacao":""}`), não texto.
3. **`estado` vai por extenso** (`"Goiás"`), mapa em `U8` do bundle.
4. **CEP com traço** (`74968-546`) e **CPF/CNPJ mascarados** (`812.450.379-60`).
5. **`dataVencimentoFatura` é número** (`10`), `dataNascimento` é `AAAA-MM-DD`.
6. **`representante`** leva só os campos que a sessão tem: `gestor3`, `equipe` e
   `regional` **não vão** (mandar `""` quebra).
7. **`tipoProposta`** é o tipo de imóvel: `Casa/apto` | `Comércio` | `Indústria` |
   `Rural` | `Outros` (lista `v5` do bundle).
8. UC só com **dígitos, máx. 15** (`/^\d+$/`) e precisa estar **disponível**:
   `GET /csp/representante/validar/uc?uc=<digits>` → "disponível".
9. CEP precisa ser coberto: `GET /csp/consultacep/cep/<8 digits>` → `valido: 1`
   (devolve logradouro/bairro/cidade prontos).

---

## 6. Evidência (mesma fatura, dois cards)

Lista de propostas no painel, 27/09/2026:

| idCard | Como foi criada | Mensalidade |
|---|---|---|
| `1451381557` | fluxo de onboarding (o antigo) | **R$ 0,00** ❌ |
| `1451384681` | **fluxo ARP (o certo)** | **R$ 4.015,79** ✅ |

Card ARP: **economia anual prevista R$ 21.964,61**, status "Aguardando Aceite".
Os dois são de teste (nome *Teste Automatizado Stkcrm*) e serão apagados à mão.

---

## 7. Mapa de endpoints ARP (iris.axsenergia.com.br)

**Escrita**
- `POST /csp/representante/login/` → token
- `POST /csp/representante/criar/card/` → **201 + idCard** (o que interessa)
- `POST /csp/fatura/salvar` (bytes do arquivo; params `idCard`, `nomeArquivo`)
- `POST /csp/fatura/excluir`
- `POST /csp/representante/fase/analise-financeira` `{idCard, motivo}`
- `POST /csp/proposta/gerar/` (simulação; header `tennant: ARP`)
- `POST /csp/tarifa/tarifaResidual/calcular`, `POST /csp/bandeira/validarVigente`
- `POST /csp/usuario/alterar/observacao`
- `DELETE /csp/representante/excluir/card/{idCard}` (limpeza de teste)

**Leitura**
- `GET /csp/cliente/consultar/card/{idCard}` — **funciona SEM token**; devolve o card
  inteiro (`fase`, `status_arp`, `mensalidade_axs`, consumo por mês, fatura…)
- `GET /csp/representante/v2/cards/consultar`, `GET /csp/representante/dashboard`
- `GET /csp/estadoconce/conce/rep` → concessionárias do representante
- `GET /csp/consultacep/cep/{cep}`, `GET /csp/representante/validar/uc?uc=`

**Quebrado (fica o aviso)**
- `POST /csp/representante/coletaDados/fatura` (análise da imagem da fatura) →
  `500 <CLASS DOES NOT EXIST> AXS.BS.Representante.ColetaDadosFatura`.
  Ou seja: **a AXS não lê a imagem** — o cálculo vem dos números do histórico,
  não do anexo. O anexo é só comprovação.
- `POST /csp/usuario/onboarding/coletaDados/fatura` → `404` (o próprio portal
  ignora a falha dele: try/catch com "você pode continuar preenchendo manualmente").

---

## 8. O que já está pronto na Fase 3

- **Fila** `fila_propostas_axs` (migration 091, aplicada), tela `Fila AXS`,
  retry com backoff, botão "marcar como feita manualmente".
- **Worker** com o processador da fila (`worker/fila_axs.py`).
- **`worker/axs_api.py`** → reescrito para o fluxo ARP (login + `criar/card`).
- **Cofre**: login ARP salvo como `vault_e0b86ef4694c` (preenche o navegador sozinho).

---

## 9. Próximo passo (Fase 4 / M2)

Rodar o M2 com a fila já em produção — o único pré-requisito restante é a senha ARP
no env do worker (`AXS_ARP_EMAIL` / `AXS_ARP_SENHA`).
