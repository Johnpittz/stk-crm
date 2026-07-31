import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Helper: cria uma tarefa de prospecção automaticamente quando lead é atribuído
async function criarTarefaLead(supabaseAdmin: any, leadId: string, vendedorId: string) {
  try {
    // Busca dados do lead incluindo origem
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("razao_social, cnpj, cidade, estado, origem")
      .eq("id", leadId)
      .single();

    if (!lead) return;

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
    // Falha silenciosa — não quebra a atribuição do lead
    console.error("[Tarefa Lead] Erro ao criar tarefa:", err);
  }
}

// ============================================================
// GET /api/leads?status=&origem=&busca=&vendedor_id=&limit=
// Lista leads (RLS já filtra por gestor/vendedor)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Busca perfil do usuário para saber o cargo
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();

    const isDiretoria = ["diretor", "admin"].includes(meuPerfil?.cargo || "");
    const isGestor = meuPerfil?.cargo === "gerente_comercial";
    const isDemo = (meuPerfil?.cargo || "") === "demonstracao";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const origem = searchParams.get("origem");
    const busca = searchParams.get("busca");
    const vendedorId = searchParams.get("vendedor_id");
    const dataInicio = searchParams.get("data_inicio");
    const dataFim = searchParams.get("data_fim");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    // Se for gestor, busca os IDs dos vendedores da sua equipe
    let vendedoresEquipe: string[] = [];
    if (isGestor) {
      const { data: vendedores } = await supabase
        .from("profiles")
        .select("id")
        .eq("cargo", "vendedor")
        .eq("gestor_id", user.id);
      vendedoresEquipe = vendedores?.map((v) => v.id) || [];
      // Inclui o próprio gestor caso tenha leads atribuídos
      vendedoresEquipe.push(user.id);
    }

    let query = supabase
      .from("leads")
      .select("*, vendedor:vendedor_id(id, nome_completo)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    if (origem) {
      query = query.eq("origem", origem);
    }

    if (vendedorId) {
      query = query.eq("vendedor_id", vendedorId);
    }

    if (busca) {
      // Escapa caracteres curinga do SQL para prevenir injeção
      const buscaLimpa = busca.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`razao_social.ilike.%${buscaLimpa}%,cnpj.ilike.%${buscaLimpa}%`);
    }

    if (dataInicio) {
      query = query.gte("created_at", dataInicio);
    }

    if (dataFim) {
      query = query.lte("created_at", `${dataFim}T23:59:59.999Z`);
    }

    // Filtro por demonstração: só vê seus próprios leads
    if (isDemo) {
      query = query.eq("vendedor_id", user.id);
    }
    // Filtro por equipe para gestores (não-diretoria)
    // Gestor vê leads dos vendedores da sua equipe + leads não atribuídos
    else if (isGestor && vendedoresEquipe.length > 0) {
      const ids = vendedoresEquipe.join(",");
      query = query.or(`vendedor_id.in.(${ids}),vendedor_id.is.null`);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [], total: count || 0 });
  } catch (err: any) {
    console.error("[Leads GET] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao listar leads" },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/leads
// Atualiza lead (atribuir vendedor, mudar status, observações)
// Body: { id, vendedor_id?, status?, observacoes? }
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, vendedor_id, status, observacoes } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do lead é obrigatório" }, { status: 400 });
    }

    // Verifica papel
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();

    const isDiretoria = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

    const updateData: any = {};

    if (isDiretoria) {
      // Gestor pode tudo
      if (vendedor_id !== undefined) {
        updateData.vendedor_id = vendedor_id || null;
        if (vendedor_id) {
          updateData.data_atribuicao = new Date().toISOString();
        }
      }
      if (status !== undefined) updateData.status = status;
      if (observacoes !== undefined) updateData.observacoes = observacoes;
    } else {
      // Vendedor só pode editar status e observações dos seus leads
      if (vendedor_id !== undefined) {
        return NextResponse.json(
          { error: "Vendedores não podem reatribuir leads" },
          { status: 403 }
        );
      }

      // Verifica se o lead pertence ao vendedor
      const { data: leadAtual } = await supabase
        .from("leads")
        .select("vendedor_id")
        .eq("id", id)
        .single();
      if (leadAtual?.vendedor_id !== user.id) {
        return NextResponse.json(
          { error: "Sem permissão para editar este lead" },
          { status: 403 }
        );
      }

      if (status !== undefined) updateData.status = status;
      if (observacoes !== undefined) updateData.observacoes = observacoes;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select("*, vendedor:vendedor_id(id, nome_completo)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se atribuiu vendedor, cria tarefa automática na agenda
    if (vendedor_id && lead) {
      const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await criarTarefaLead(supabaseAdmin, id, vendedor_id);
    }

    return NextResponse.json({ success: true, lead });
  } catch (err: any) {
    console.error("[Leads PATCH] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao atualizar lead" },
      { status: 500 }
    );
  }
}
