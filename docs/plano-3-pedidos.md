# Plano — 3 pedidos do João (11/10/2026)

Decisões fechadas com ele (clarify de 11/10): ordem de execução = 1 → 2 → 3;
no fim de CADA pedido completo, entregar um **guia simples (.docx)**.

## PEDIDO 1 — Dashboard do Vendedor: Potencial de Vendas ✅ CONCLUÍDO (11/10)
Publicado junto com CHANGELOG 1.8.15: rota, página `/potencial-vendas` e
item no menu (2 testes novos de lib+rota, 481 no total, build verde).
Guia simples .docx entregue ao João.

- **O que é:** visão gerencial de quanto cada vendedor vendeu, **por
  produto** ("o que ele vendeu mais") para direcionar mais demanda.
- **Dados (sem migration):** `oportunidades` com `resultado = 'sucesso'`
  (venda confirmada no modal "Registrar resultado"), `valor_venda`,
  `produto_id`, `vendedor_id`, `updated_at` (proxy de quando vendeu).
- **Perfis (padrão Fase 4):** admin/diretor/gerente_comercial = todos;
  vendedor = só o dele (filtro no servidor).
- **Peças:** `lib/dashboard/potencial.ts` (agrupa vendedor × mix de
  produtos, produto líder, participação %), rota
  `/api/dashboard/potencial-vendas?dias=30|90|...`, página
  `/potencial-vendas` + item no menu lateral.
- **Leitura:** ranking de vendedores por valor, mix por produto em
  barra, destaque "💡 Produto líder — direcione mais demanda".

## PEDIDO 2 — Base de Conhecimento do Vendedor ✅ CÓDIGO PRONTO (11/10)
**Aguardando o João rodar `supabase/migrations/096_base_vendedor_cursos.sql`
→ depois do "aplicou", fazer o PUSH** (senão a query da IA quebra pedindo
a coluna `vendedor_id`). Depois do push: guia .docx entregue.

- A **IA do atendimento usa a base do vendedor dono da conversa**
  (somando à global) + vendedor consulta na tela.
- **Cursos do SINERGIA** aparecem como **link/botão** que abre o curso
  lá no sinergiahub.com.br (conta do vendedor já cadastrada lá).
- Peças previstas: coluna `vendedor_id` na base de conhecimento (ou
  tabela nova por vendedor), tela "Minha Base" + gestão admin, cursos
  (id/nome/URL) por vendedor, IA passa a filtrar por vendedor.
- ⚠️ Não mexer nos cursos do SINERGIA (o sistema de cursos de lá segue
  intacto — só linkamos).

## PEDIDO 3 — Arte personalizada + disparo (MARKETING) ✅ CONCLUÍDO (12/10)
Migration 097 aplicada + GEMINI_API_KEY na Vercel → push `a68c8d9`;
teste real: arte gerada ao vivo (Gemini, ~8s, PNG 993KB no bucket) e
botão Disparar entregou a imagem no /disparo. Guia .docx entregue.

**MELHORIA (12/10) — imagens de referência estilo AUTOIMAGEM:** admin sobe
logo/foto na tela de artes → vira marker `{{slug}}` citável no Observações
(sem citar → na frente do pedido). Pronto local: tabela `artes_referencias`
(**migration 098**), rota `/api/marketing/artes/referencias`, `montarPartesImagem`
+ `partes` no Gemini, seção na tela; 521 testes verdes. ⏳ aguarda SQL 098 →
push → teste ao vivo → guia atualizado.

- **Assistente guiado:** escolhe tipo de post (feed Insta, story,
  Facebook, capa…) + campos (produto, estilo, texto, CTA) → tudo vira
  **um prompt grande** → **Gemini** gera a arte (`GEMINI_API_KEY` na
  Vercel; modelo `gemini-2.5-flash-image`, receita do AUTOIMAGEM em
  `/root/autoimagem`, repo `Johnpittz/autoimagem`).
- **Galeria** salva no Supabase (storage) + histórico.
- **Botão "Disparar"** na tela da arte → leva a imagem pronta para a
  **fila de disparo** (BulkSender já suporta `imagem_url`) com passo a
  passo.
- Ecosistema inteiro dentro de **MARKETING** (menu).

## Regras transversais

- TDD (RED → GREEN), gates: `npm test` + `npx tsc --noEmit` + `npm run
  build` local + `python3 -m unittest` (worker, quando mexer nele).
- Commit com arquivos explícitos; push só com o combo verde.
- CHANGELOG (versão nova) + HANDOFF atualizados a cada entrega.
- Guia .docx simples por pedido (formato "Resumo Simples" aprovado).
