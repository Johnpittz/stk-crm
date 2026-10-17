# PLANO — Ajustes CRM > CLIENTES (PPTX 17/10)

Decisões (clarify 17/10):
1. Origem nova: tipo (vendedor/parceiro/marketing) + subtipo + vendedor
   vinculado (select de cadastrados) ou nome do parceiro.
2. Saem da criação e edição: "Dados de Energia" e "Consumo Mensal".
3. Salvar (novo): cria card pré-preenchido no kanban (coluna RECEBEU A
   CONTA), mostra kanban na tela + botões [Upload da conta] (vai pra
   Gestão de Fatura) e [Análise da conta] (IA lê a conta, extrai dados).
4. Card sai com nome + telefone do cliente.

Passos: A lib origem → B migration 101 → C payload → D rota vendedores →
E formulários → F POST oportunidade(vendedor_id) → G painel pós-salvar →
H análise IA → I ?aba=gestao_fatura → J gates/deploy/teste ao vivo.
