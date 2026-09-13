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

    // Buscar colunas que existem na tabela
    // Primeiro tentar com SELECT simples para descobrir colunas disponíveis
    let query = supabase
      .from("clientes")
      .select("*", { count: "exact" });

    // Busca por nome, CPF/CNPJ, email, telefone (apenas colunas que existem)
    if (search) {
      // Usar ilike em colunas que com certeza existem
      const searchFilter = `nome_completo.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`;
      query = query.or(searchFilter);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Erro na busca de clientes:", error.message);
      // Fallback: buscar sem filtro
      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (fallbackError) throw fallbackError;

      return NextResponse.json({
        clientes: fallbackData || [],
        total: fallbackCount || 0,
        page,
        pageSize,
        totalPages: Math.ceil((fallbackCount || 0) / pageSize),
      });
    }

    return NextResponse.json({
      clientes: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error: any) {
    console.error("Erro interno:", error.message);
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

    // Dados básicos - colunas que EXISTEM na tabela clientes
    const clienteData: Record<string, any> = {
      nome_razao_social: body.nome_razao_social || body.nome_completo || null,
      email: body.email || null,
      telefone: body.telefone || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      status: body.status || "ativo",
      observacoes: body.observacoes || null,
    };

    // Adicionar colunas opcionais apenas se fornecidas
    if (body.cnpj_cpf || body.cpf_cnpj) clienteData.cnpj_cpf = body.cnpj_cpf || body.cpf_cnpj;
    if (body.celular) clienteData.celular = body.celular;
    if (body.whatsapp) clienteData.whatsapp = body.whatsapp;
    if (body.concessionaria) clienteData.concessionaria = body.concessionaria;
    if (body.classe_tarifaria) clienteData.classe_tarifaria = body.classe_tarifaria;
    if (body.subgrupo_tarifario) clienteData.subgrupo_tarifario = body.subgrupo_tarifario;
    if (body.bandeira) clienteData.bandeira = body.bandeira;
    if (body.vencimento_fatura) clienteData.vencimento_fatura = body.vencimento_fatura;
    if (body.instalacao) clienteData.instalacao = body.instalacao;
    if (body.endereco) clienteData.endereco = body.endereco;
    if (body.numero) clienteData.numero = body.numero;
    if (body.complemento) clienteData.complemento = body.complemento;
    if (body.bairro) clienteData.bairro = body.bairro;
    if (body.cep) clienteData.cep = body.cep;

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
    console.error("Erro ao criar cliente:", error.message);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
