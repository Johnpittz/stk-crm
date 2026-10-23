import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapearFaturaDb, type FaturaDb } from "@/lib/reciee/adaptadores";
import { montarEmailConcessionaria } from "@/lib/reciee/email";
import { validarFatura, validarSequencia } from "@/lib/reciee/validar";
import type { Achado, FaturaReciee } from "@/lib/reciee/tipos";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/reciee/clientes/[clienteId]/validar
 *
 * Roda o motor determinístico sobre as faturas do cliente, GRAVA os achados
 * em `analises_reciee` (sem migration nova) e devolve o email pronto para a
 * concessionária — a mesma entrega da auditoria, agora dentro do CRM.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const { clienteId } = params;
    if (!clienteId) {
      return NextResponse.json({ error: "clienteId is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: cliente, error: erroCliente } = await supabase
      .from("clientes_reciee")
      .select("*")
      .eq("id", clienteId)
      .single();
    if (erroCliente || !cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const { data: linhas, error: erroFaturas } = await supabase
      .from("faturas_reciee")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("competencia", { ascending: true });
    if (erroFaturas) {
      return NextResponse.json({ error: "Erro ao ler faturas" }, { status: 500 });
    }

    const brutas = (linhas ?? []) as unknown as (FaturaDb & { id: string })[];
    const faturas: FaturaReciee[] = brutas.map(mapearFaturaDb);

    const porFatura = new Map<string, Achado[]>();
    const todos: Achado[] = [];
    brutas.forEach((bruta, i) => {
      const f = faturas[i];
      const achados = validarFatura(f);
      porFatura.set(bruta.id, achados);
      todos.push(...achados);
    });
    todos.push(...validarSequencia(faturas));

    // Reescreve os achados deste cliente (motor substitui a própria análise)
    const ids = brutas.map((b) => b.id);
    if (ids.length > 0) {
      await supabase.from("analises_reciee").delete().in("fatura_id", ids);
      const novos = brutas.flatMap((bruta) =>
        (porFatura.get(bruta.id) ?? []).map((a) => ({
          fatura_id: bruta.id,
          macro_indice: a.tema,
          codigo: a.codigo,
          descricao: a.descricao,
          severidade: a.severidade,
          valor_estimado: a.valorEstimado,
        }))
      );
      if (novos.length > 0) {
        const { error: erroInsert } = await supabase
          .from("analises_reciee")
          .insert(novos);
        if (erroInsert) {
          return NextResponse.json(
            { error: "Erro ao gravar análises" },
            { status: 500 }
          );
        }
      }
    }

    const email = montarEmailConcessionaria({
      cliente: {
        nome: cliente.nome ?? "",
        uc: cliente.uc ?? "",
        cpf_cnpj: cliente.cpf_cnpj,
        cidade: cliente.cidade,
        estado: cliente.estado,
        distribuidora: cliente.distribuidora,
      },
      faturas,
      achados: todos,
    });

    const criticos = todos.filter((a) => a.severidade === "critico");
    const alertas = todos.filter((a) => a.severidade === "alerta");

    return NextResponse.json({
      clienteId,
      faturas: faturas.length,
      achados: todos,
      resumo: {
        criticos: criticos.length,
        alertas: alertas.length,
        gravados: todos.filter((a) => a.referencia).length,
        valorEmDisputa:
          Math.round(
            todos.reduce((s, a) => s + a.valorEstimado, 0) * 100
          ) / 100,
      },
      email,
    });
  } catch (e) {
    console.error("[reciee/validar]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
