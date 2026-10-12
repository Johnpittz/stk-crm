/**
 * PEDIDO 1 (11/10) — GET /api/dashboard/potencial-vendas.
 *
 * "Dashboard do vendedor: POTENCIAL DE VENDAS" — quantas vendas cada
 * vendedor fechou e DE QUAL PRODUTO ele mais vende (a gestão lê e manda
 * mais demanda daquele produto para ele).
 *
 * Venda = `oportunidades.resultado = 'sucesso'` (registrada no modal
 * "Registrar resultado da oportunidade") com `valor_venda`. Período por
 * `updated_at` (proxy: a linha muda quando o resultado é registrado).
 *
 * Perfil (padrão Fase 4, filtro AQUI no servidor):
 *   admin/diretor/gerente_comercial = todos os vendedores;
 *   vendedor = só as próprias vendas.
 *
 * Query: ?dias=30|90|... (padrão 30, teto 365).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { montarPotencial, type VendaConfirmada } from "@/lib/dashboard/potencial";

export const dynamic = "force-dynamic";

const PADRAO_DIAS = 30;
const LIMITE_VENDAS = 1000;

function lerDias(url: string): number {
  const bruto = Number(new URL(url).searchParams.get("dias"));
  if (!Number.isFinite(bruto) || bruto <= 0) return PADRAO_DIAS;
  return Math.min(Math.round(bruto), 365);
}

export async function GET(request: NextRequest) {
  try {
    const usuarioClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await usuarioClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const { data: meuPerfil } = await usuarioClient
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();
    const cargo = meuPerfil?.cargo || "";
    const visaoAmpla = ["admin", "diretor", "gerente_comercial"].includes(cargo);

    const dias = lerDias(request.url);
    const supabase = createAdminClient();
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("oportunidades")
      .select("vendedor_id, produto_id, valor_venda, updated_at")
      .eq("resultado", "sucesso")
      .gte("updated_at", desde);
    if (!visaoAmpla) query = query.eq("vendedor_id", user.id);
    const { data: vendas, error: erroVendas } = await query
      .order("updated_at", { ascending: false })
      .limit(LIMITE_VENDAS);
    if (erroVendas) throw erroVendas;

    const { data: profiles, error: erroProfiles } = await supabase
      .from("profiles")
      .select("id, nome_completo, email")
      .limit(500);
    if (erroProfiles) throw erroProfiles;
    const nomes: Record<string, string> = {};
    for (const p of profiles ?? []) {
      nomes[p.id] =
        p.nome_completo || (p.email ? String(p.email).split("@")[0] : "") || "Conta sem cadastro";
    }

    const { data: produtos, error: erroProdutos } = await supabase
      .from("produtos")
      .select("id, nome")
      .limit(200);
    if (erroProdutos) throw erroProdutos;
    const mapaProdutos: Record<string, string> = {};
    for (const p of produtos ?? []) mapaProdutos[p.id] = p.nome;

    const vendedores = montarPotencial(
      (vendas ?? []) as VendaConfirmada[],
      nomes,
      mapaProdutos,
    );

    const total_geral = vendedores.reduce(
      (acc, v) => ({
        total_vendas: acc.total_vendas + v.total_vendas,
        valor_total: acc.valor_total + v.valor_total,
      }),
      { total_vendas: 0, valor_total: 0 },
    );

    return NextResponse.json({
      perfil: cargo || "vendedor",
      periodo_dias: dias,
      vendedores,
      total_geral,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 },
    );
  }
}
