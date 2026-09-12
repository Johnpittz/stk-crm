import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET - Listar clientes com busca e paginação
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("clientes")
      .select("*", { count: "exact" });

    // Busca por nome, CPF/CNPJ, email, telefone
    if (search) {
      query = query.or(
        `nome_razao_social.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,celular.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      clientes: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// POST - Criar cliente
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Dados básicos
    const clienteData: Record<string, any> = {
      nome_razao_social: body.nome_razao_social,
      cpf_cnpj: body.cpf_cnpj || null,
      email: body.email || null,
      telefone: body.telefone || null,
      whatsapp: body.whatsapp || null,
      celular: body.celular || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      endereco: body.endereco || null,
      numero: body.numero || null,
      complemento: body.complemento || null,
      bairro: body.bairro || null,
      cep: body.cep || null,
      tipo_cliente: body.tipo_cliente || null,
      status: body.status || "ativo",
      classificacao: body.classificacao || null,
      origem: body.origem || null,
      observacoes: body.observacoes || null,
      // Dados energéticos
      concessionaria: body.concessionaria || null,
      classe_tarifaria: body.classe_tarifaria || null,
      subgrupo_tarifario: body.subgrupo_tarifario || null,
      vencimento_fatura: body.vencimento_fatura || null,
      instalacao: body.instalacao || null,
      bandeira: body.bandeira || null,
      iluminacao_publica: body.iluminacao_publica || null,
      consorcio: body.consorcio || null,
      usina: body.usina || null,
      // Consumo
      consumo_jan: body.consumo_jan || null,
      consumo_fev: body.consumo_fev || null,
      consumo_mar: body.consumo_mar || null,
      consumo_abr: body.consumo_abr || null,
      consumo_mai: body.consumo_mai || null,
      consumo_jun: body.consumo_jun || null,
      consumo_jul: body.consumo_jul || null,
      consumo_ago: body.consumo_ago || null,
      consumo_set: body.consumo_set || null,
      consumo_out: body.consumo_out || null,
      consumo_nov: body.consumo_nov || null,
      consumo_dez: body.consumo_dez || null,
      // Geração
      geracao_propria: body.geracao_propria || null,
      geracao_jan: body.geracao_jan || null,
      geracao_fev: body.geracao_fev || null,
      geracao_mar: body.geracao_mar || null,
      geracao_abr: body.geracao_abr || null,
      geracao_mai: body.geracao_mai || null,
      geracao_jun: body.geracao_jun || null,
      geracao_jul: body.geracao_jul || null,
      geracao_ago: body.geracao_ago || null,
      geracao_set: body.geracao_set || null,
      geracao_out: body.geracao_out || null,
      geracao_nov: body.geracao_nov || null,
      geracao_dez: body.geracao_dez || null,
      // AXS
      axs_card_id: body.axs_card_id || null,
      axs_status: body.axs_status || null,
      axs_mensalidade: body.axs_mensalidade || null,
      axs_data_envio: body.axs_data_envio || null,
    };

    // Validação mínima
    if (!clienteData.nome_razao_social) {
      return NextResponse.json(
        { error: "nome_razao_social é obrigatório" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert(clienteData)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ cliente: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
