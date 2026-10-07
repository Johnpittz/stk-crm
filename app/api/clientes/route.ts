import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { montarPayloadCliente } from "@/lib/clientes/montar-payload";
import { registrarAuditoria } from "@/lib/auditoria";
import { usuarioAtual } from "@/lib/auth/usuario-atual";

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

    // 06/10: o formulário inteiro passa pelo mapeador de colunas REAIS
    // (antes o create jogava fora endereço/energia/consumo e os campos
    // novos de contato/proprietário).
    const clienteData: Record<string, any> = montarPayloadCliente({
      ...body,
      status: body.status || "ativo",
    });

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

    // LOG DE CRIAÇÃO (06/10) — best-effort, nunca derruba o create
    const usuario = await usuarioAtual().catch(() => null);
    await registrarAuditoria(supabase, {
      clienteId: data.id,
      clienteNome: data.nome_razao_social ?? null,
      acao: "criado",
      campos: Object.keys(clienteData)
        .filter((k) => clienteData[k] != null)
        .sort(),
      usuario: usuario ? { id: usuario.id, email: usuario.email } : null,
    });

    return NextResponse.json({ cliente: data }, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar cliente:", error.message);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
