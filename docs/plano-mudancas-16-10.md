# PLANO DE MUDANÇAS — levantamento do João (16/10/2026)

Executar **por partes**, cada uma com teste (RED→GREEN), gates
(`npm test` + `tsc` + build + unittest worker) e publicação própria.

| # | Local | Mudança | Status |

> **Entrega final (pedido do João 16/10):** ao concluir TODAS as 10 mudanças, gerar **documento Word** com as mudanças de forma muito simples de entender. |
|---|-------|---------|--------|
| 1 | CRM/Clientes (cadastrar/editar) | Se **CPF** (pessoa física): tirar "Nome do contato" e "CPF do proprietário"; endereço não é "da empresa" | ✅ |
| 2 | Marketing | Juntar tudo de disparo em **DISPARO** (hoje tem "Novo Disparo" dentro de Campanhas duplicando) | ✅ 16/10 (tela única /disparo; menus Campanhas/Relatórios removidos) |
| 3 | Marketing/Gerar Artes | Opções de texto na imagem (número, endereço, dados que fazem achar) + **posição** (canto superior/inferior/rodapé…) + **gravar como cadastro** (dados de contato) | ✅ |
| 4 | CRM/Atendimento | Sem nome identificado: mostrar **"CLIENTE — 6298…"** (número na frente) em vez de só "CLIENTE" | ✅ |
| 5 | CRM/Funil de Vendas | Cards do Kanban precisam de **edição** (hoje não há) | ✅ |
| 6 | CRM (geral) | **Testar** o Log de Alterações (editar cliente → log gravado) | ✅ 16/10 (unit 10/10 + ao vivo: criado/editado com autor) |
| 7 | CRM/Dashboard | Mapear e mostrar **status, classificação e origem** (Prospect…) | ✅ |
| 8 | Marketing/Leads | **Importar lista** (PDF, Word…) + escolher **Leads** como destino no disparo em massa | ✅ |
| 9 | Marketing/Disparo | Mostrar **qual número** foi usado em cada disparo | ✅ 16/10 (coluna + detalhe, 8 testes) |
| 10 | Marketing/Disparo (modal) | Modal **não fecha** ao clicar fora; fecha só com **X** ou **ESC** | ✅ 16/10 (diálogo Criar Disparo) |

Ordem de execução (agrupa por arquivo): ~~6~~ → ~~10~~ → ~~9~~ → ~~2~~ → 4 → 5 → 1 → 3 → 7 → 8.
