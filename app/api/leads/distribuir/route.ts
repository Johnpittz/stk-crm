import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Helper: cria uma tarefa de prospecção automaticamente quando lead é atribuído
async function criarTarefaLead(supabaseAdmin: any, lead: any, vendedorId: string) {
  try {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    await supabaseAdmin.from("tarefas").insert({
      vendedor_id: vendedorId,
      titulo: `Prospecção: ${lead.razao_social}`,
      descricao: `Novo lead em sua fila — CNPJ: ${lead.cnpj}${lead.cidade ? `\nCidade: ${lead.cidade}/${lead.estado}` : ""}`,
      tipo: "prospeccao",
      prioridade: "alta",
      status: "pendente",
      coluna_kanban: "a_fazer",
      data_inicio: hoje.toISOString().split("T")[0],
      data_fim: amanha.toISOString().split("T")[0],
      origem_lead: lead.origem || "prospeccao_b2b",
    });
  } catch (err) {
    console.error("[Tarefa Lead Distribuir] Erro ao criar tarefa:", err);
  }
}

// ============================================================
// POST /api/leads/distribuir
// Body: { quantidade_por_vendedor: number, preview?: boolean }
// Distribui leads não atribuídos em round-robin para vendedores
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Verifica se é gestor
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();

    const isGestor = ["diretor", "admin", "gerente_comercial"].includes(
      meuPerfil?.cargo || ""
    );

    if (!isGestor) {
      return NextResponse.json(
        { error: "Apenas gestores podem distribuir leads" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const quantidadePorVendedor = Math.max(
      1,
      Math.min(parseInt(body.quantidade_por_vendedor || "5", 10), 50)
    );
    const preview = body.preview === true;

    // 1. Busca leads não atribuídos (status = novo, sem vendedor)
    const { data: leadsDisponiveis, error: leadsError } = await supabase
      .from("leads")
      .select("id, razao_social, cnpj, cidade, estado, origem, created_at")
      .is("vendedor_id", null)
      .eq("status", "novo")
      .order("created_at", { ascending: true })
      .limit(500);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // 2. Busca vendedores ativos (cargo = 'vendedor')
    const { data: vendedores, error: vendsError } = await supabase
      .from("profiles")
      .select("id, nome_completo, cargo")
      .eq("cargo", "vendedor")
      .order("nome_completo", { ascending: true });

    if (vendsError) {
      return NextResponse.json({ error: vendsError.message }, { status: 500 });
    }

    const vendedoresAtivos = vendedores || [];

    if (vendedoresAtivos.length === 0) {
      return NextResponse.json(
        { error: "Nenhum vendedor ativo encontrado" },
        { status: 400 }
      );
    }

    if (!leadsDisponiveis || leadsDisponiveis.length === 0) {
      return NextResponse.json(
        { error: "Nenhum lead disponível para distribuição" },
        { status: 400 }
      );
    }

    // 3. Calcula distribuição round-robin
    const totalLeads = leadsDisponiveis.length;
    const maxPorVendedor = quantidadePorVendedor;
    const distribuicao: Record<
      string,
      {
        vendedor: { id: string; nome_completo: string };
        quantidade: number;
        leads: typeof leadsDisponiveis;
      }
    > = {};

    // Inicializa mapa de vendedores
    vendedoresAtivos.forEach((v) => {
      distribuicao[v.id] = {
        vendedor: { id: v.id, nome_completo: v.nome_completo },
        quantidade: 0,
        leads: [],
      };
    });

    // Round-robin simples
    let vendedorIdx = 0;
    const vendedorIds = vendedoresAtivos.map((v) => v.id);

    for (const lead of leadsDisponiveis) {
      let atribuido = false;
      let tentativas = 0;

      // Tenta distribuir respeitando o limite por vendedor
      while (!atribuido && tentativas < vendedorIds.length) {
        const vid = vendedorIds[vendedorIdx];
        if (distribuicao[vid].quantidade < maxPorVendedor) {
          distribuicao[vid].quantidade++;
          distribuicao[vid].leads.push(lead);
          atribuido = true;
        }
        vendedorIdx = (vendedorIdx + 1) % vendedorIds.length;
        tentativas++;
      }

      // Se todos atingiram o limite, para
      if (!atribuido) break;
    }

    const resultadoDistribuicao = Object.values(distribuicao).filter(
      (d) => d.quantidade > 0
    );

    const totalDistribuir = resultadoDistribuicao.reduce(
      (sum, d) => sum + d.quantidade,
      0
    );

    // 4. Se for preview, retorna sem executar
    if (preview) {
      return NextResponse.json({
        preview: true,
        quantidade_por_vendedor: maxPorVendedor,
        total_leads_disponiveis: totalLeads,
        total_a_distribuir: totalDistribuir,
        sobrarao: totalLeads - totalDistribuir,
        vendedores: resultadoDistribuicao,
      });
    }

    // 5. Executa a distribuição
    const resultados = {
      atribuidos: 0,
      erros: 0,
      detalhes: [] as any[],
    };

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const item of resultadoDistribuicao) {
      for (const lead of item.leads) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            vendedor_id: item.vendedor.id,
            status: "em_atendimento",
            data_atribuicao: new Date().toISOString(),
          })
          .eq("id", lead.id);

        if (updateError) {
          resultados.erros++;
          resultados.detalhes.push({
            lead: lead.razao_social,
            vendedor: item.vendedor.nome_completo,
            erro: updateError.message,
          });
        } else {
          resultados.atribuidos++;
          // Cria tarefa automática na agenda do vendedor
          await criarTarefaLead(supabaseAdmin, lead, item.vendedor.id);
        }
      }
    }

    return NextResponse.json({
      preview: false,
      success: true,
      quantidade_por_vendedor: maxPorVendedor,
      total_distribuido: resultados.atribuidos,
      erros: resultados.erros,
      vendedores: resultadoDistribuicao.map((d) => ({
        vendedor: d.vendedor,
        quantidade: d.quantidade,
      })),
    });
  } catch (err: any) {
    console.error("[Leads Distribuir] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao distribuir leads" },
      { status: 500 }
    );
  }
}
