# Bateria de conversas-teste — camada 1 — cobertura da base (sem rede)

> Gerado por `lib/bateria-ia.test.ts` (roda em `npm test`). Base: fixture de exemplo
> (`lib/__fixtures__/base-conhecimento-fixture.json`) — a base real é editada no painel.

| ID | Pergunta | Esperado | Resultado | OK | O que aconteceu |
| --- | --- | --- | --- | --- | --- |
| c01 | Qual o prazo de entrega? | coberta | coberta | ✅ | base: Prazos › Prazo de entrega |
| c02 | Quanto custa a câmera IP de 4MP? | coberta | coberta | ✅ | base: Produtos › Câmera IP 4MP |
| c03 | Como posso pagar? | coberta | coberta | ✅ | base: Pagamento › Formas de pagamento |
| c04 | Tem garantia esse produto? | coberta | coberta | ✅ | base: Garantia › Garantia do fabricante |
| c05 | Vocês fazem instalação? | coberta | coberta | ✅ | base: Serviços › Instalação |
| c06 | Qual o valor do gravador de 8 canais? | coberta | coberta | ✅ | base: Produtos › Gravador DVR 8 canais |
| c07 | Qual o horário de atendimento? | coberta | coberta | ✅ | base: Contato › Horário de atendimento |
| c08 | Vocês atendem em outra cidade? | coberta | coberta | ✅ | base: Cobertura › Área de atendimento |
| c09 | Quando meu pedido chega? | coberta | coberta | ✅ | base: Prazos › Prazo de entrega |
| c10 | Vocês vendem computador? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c11 | Qual a cotação do dólar hoje? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c12 | Preciso de um eletricista para minha casa | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c13 | Vocês fazem manutenção de elevadores? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c14 | Tem vaga para estágio aí? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c15 | Qual o placar do jogo de ontem? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |
| c16 | Qual a lente de 4mm? | encaminhamento | encaminhamento | ✅ | sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume |

Total: 16 · bateram: 16 · divergiram: 0
