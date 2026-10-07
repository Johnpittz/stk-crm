import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { camposAlterados, registrarAuditoria } from "@/lib/auditoria";
import { usuarioAtual } from "@/lib/auth/usuario-atual";

export const dynamic = "force-dynamic";

// GET - Buscar cliente por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = createAdminClient();
    const { clienteId: id } = params;

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ cliente: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = createAdminClient();
    const { clienteId: id } = params;
    const body = await request.json();

    // Campos permitidos = colunas REAIS da tabela clientes (06/10: saíram
    // `cpf_cnpj`/`origem`/`bandeira`, que não são colunas — mandá-las quebrava
    // o update — e entraram os campos novos de contato/proprietário).
    const allowedFields = [
      // Dados básicos
      "nome_razao_social", "cnpj_cpf", "rg_ie", "data_nascimento",
      "email", "telefone", "whatsapp", "celular",
      "nome_contato", "cargo_contato", "cpf_proprietario",
      "data_nascimento_proprietario",
      "cidade", "estado", "endereco", "numero", "complemento",
      "bairro", "cep", "tipo_cliente", "status", "classificacao",
      "origem_lead", "observacoes",
      // Dados energéticos
      "concessionaria", "classe_tarifaria", "subgrupo_tarifario",
      "vencimento_fatura", "instalacao", "iluminacao_publica",
      "consorcio", "usina",
      // Consumo
      "consumo_jan", "consumo_fev", "consumo_mar", "consumo_abr",
      "consumo_mai", "consumo_jun", "consumo_jul", "consumo_ago",
      "consumo_set", "consumo_out", "consumo_nov", "consumo_dez",
      // Geração
      "geracao_propria", "geracao_jan", "geracao_fev", "geracao_mar",
      "geracao_abr", "geracao_mai", "geracao_jun", "geracao_jul",
      "geracao_ago", "geracao_set", "geracao_out", "geracao_nov",
      "geracao_dez",
      // AXS
      "axs_card_id", "axs_status", "axs_mensalidade", "axs_data_envio",
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      );
    }

    // Linha ANTERIOR (para o log de edição dizer o QUE mudou)
    const { data: antes } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!antes) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("clientes")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // LOG DE EDIÇÃO (06/10) — best-effort, nunca derruba o save
    const campos = camposAlterados(antes, updateData);
    if (campos.length > 0) {
      const usuario = await usuarioAtual().catch(() => null);
      await registrarAuditoria(supabase, {
        clienteId: id,
        clienteNome: data.nome_razao_social ?? null,
        acao: "editado",
        campos,
        usuario: usuario ? { id: usuario.id, email: usuario.email } : null,
      });
    }

    return NextResponse.json({ cliente: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = createAdminClient();
    const { clienteId: id } = params;

    const { data, error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, cliente: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
