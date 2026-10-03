import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STATUS_FILA,
  validarPayloadProposta,
  podeAvancarEtapa,
  ETAPA_RETROALIMENTO,
} from "@/lib/axs/fila";

export const dynamic = "force-dynamic";

/**
 * Fase 3 / C3 — fila "cadastrar no CRM → criar na AXS".
 *
 *  POST   /api/axs/fila  → enfileira a proposta (o form não dispara mais na hora)
 *  GET    /api/axs/fila  → lista a fila (vendedor vê as suas, gestor vê todas)
 *  PATCH  /api/axs/fila  → ações: retry (tentar de novo) | manual (feita à mão)
 *
 * O envio em si é do worker (worker/fila_axs.py), não destas rotas.
 */

const CARGOS_GESTOR = ["diretor", "admin", "gerente_comercial"];
const ETAPAS_ABERTAS = ["recebeu_conta", "proposta_a_fazer"];
const STATUS_BLOQUEIA_NOVO = ["pendente", "enviando"];

interface Usuario {
  id: string;
  cargo: string;
  email: string;
}

function ehGestor(usuario: Usuario): boolean {
  return CARGOS_GESTOR.includes((usuario.cargo || "").toLowerCase());
}

async function usuarioAtual(): Promise<Usuario | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("cargo, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    cargo: perfil?.cargo ?? "",
    email: perfil?.email ?? user.email ?? "",
  };
}

/**
 * Retroalimentação do funil: a criação confirmada (ou marcada como manual)
 * move a oportunidade para "proposta_feita" — só se ela estiver numa etapa
 * anterior (`podeAvancarEtapa`), para nunca regredir o funil de quem já
 * avançou. Grava o histórico do Kanban.
 */
async function avancarFunil(
  admin: ReturnType<typeof createAdminClient>,
  oportunidadeId: string | null,
  autorId: string
): Promise<boolean> {
  if (!oportunidadeId) return false;

  const { data: opp } = await admin
    .from("oportunidades")
    .select("id, etapa")
    .eq("id", oportunidadeId)
    .maybeSingle();

  if (!opp || !podeAvancarEtapa(opp.etapa)) return false;

  const { data: atualizada } = await admin
    .from("oportunidades")
    .update({ etapa: ETAPA_RETROALIMENTO })
    .eq("id", oportunidadeId)
    .eq("etapa", opp.etapa)
    .select("id");

  if (!atualizada?.length) return false;

  await admin.from("oportunidade_historico").insert({
    oportunidade_id: oportunidadeId,
    etapa_anterior: opp.etapa,
    etapa_nova: ETAPA_RETROALIMENTO,
    observacao: "Proposta criada na AXS pela fila do CRM",
    created_by: autorId,
  });

  return true;
}

/** GET — lista a fila. */
export async function GET(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const clienteId = params.get("cliente_id");
  const limite = Number(params.get("limite") || 200);

  const admin = createAdminClient();
  let consulta = admin
    .from("fila_propostas_axs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Number.isFinite(limite) && limite > 0 ? limite : 200);

  if (status && STATUS_FILA.includes(status as any)) {
    consulta = consulta.eq("status", status);
  }
  if (clienteId) {
    consulta = consulta.eq("cliente_id", clienteId);
  }
  if (!ehGestor(usuario)) {
    consulta = consulta.eq("vendedor_id", usuario.id);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Passo 9 do guia: mostrar a mensalidade ao lado do item "Criada na AXS".
  // Ela nasce no criar/card da AXS e o worker grava em clientes.axs_mensalidade;
  // aqui a gente junta de volta no item (sem migration — coluna já existe).
  const itens = data ?? [];
  const ids = Array.from(
    new Set(itens.map((i: any) => i.cliente_id).filter(Boolean))
  );
  const mensalidades: Record<string, number | null> = {};
  if (ids.length) {
    const { data: clientes } = await admin
      .from("clientes")
      .select("id, axs_mensalidade")
      .in("id", ids as string[]);
    for (const c of clientes ?? []) {
      mensalidades[c.id] = c.axs_mensalidade ?? null;
    }
  }
  const comMensalidade = itens.map((i: any) => ({
    ...i,
    mensalidade: mensalidades[i.cliente_id] ?? null,
  }));

  return NextResponse.json({ itens: comMensalidade, gestor: ehGestor(usuario) });
}

/** POST — enfileira a proposta. */
export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const clienteId = body?.cliente_id;
  const dados = body?.dados_proposta;

  if (!clienteId || typeof clienteId !== "string" || !dados) {
    return NextResponse.json(
      { error: "cliente_id e dados_proposta são obrigatórios" },
      { status: 400 }
    );
  }

  const erros = validarPayloadProposta(dados);
  if (erros.length) {
    return NextResponse.json(
      { error: "Proposta incompleta", erros },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: cliente } = await admin
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Um item pendente/enviando por cliente (a migration também impõe isso).
  const { data: emAndamento } = await admin
    .from("fila_propostas_axs")
    .select("id, status")
    .eq("cliente_id", clienteId)
    .in("status", STATUS_BLOQUEIA_NOVO)
    .maybeSingle();

  if (emAndamento) {
    return NextResponse.json(
      { error: "Este cliente já tem uma proposta na fila", id: emAndamento.id },
      { status: 409 }
    );
  }

  // Oportunidade: a explícita ou a mais recente em etapa aberta do funil.
  let oportunidadeId: string | null =
    typeof body.oportunidade_id === "string" && body.oportunidade_id
      ? body.oportunidade_id
      : null;

  if (!oportunidadeId) {
    const { data: opp } = await admin
      .from("oportunidades")
      .select("id, etapa")
      .eq("cliente_id", clienteId)
      .in("etapa", ETAPAS_ABERTAS)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    oportunidadeId = opp?.id ?? null;
  }

  const agora = new Date().toISOString();
  const { data: item, error } = await admin
    .from("fila_propostas_axs")
    .insert({
      cliente_id: clienteId,
      oportunidade_id: oportunidadeId,
      vendedor_id: usuario.id,
      payload: dados,
      status: "pendente",
      tentativas: 0,
      origem: "crm",
      proxima_tentativa: agora,
      created_at: agora,
    })
    .select("*")
    .single();

  if (error || !item) {
    return NextResponse.json(
      { error: error?.message || "Não foi possível enfileirar a proposta" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item }, { status: 201 });
}

/** PATCH — ações da fila: `retry` (tentar de novo) e `manual` (feita à mão). */
export async function PATCH(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const id = body?.id;
  const acao = body?.acao;

  if (!id || !["retry", "manual"].includes(acao)) {
    return NextResponse.json(
      { error: "id e acao ('retry' | 'manual') são obrigatórios" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("fila_propostas_axs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item da fila não encontrado" }, { status: 404 });
  }

  if (item.vendedor_id !== usuario.id && !ehGestor(usuario)) {
    return NextResponse.json(
      { error: "Sem permissão para alterar este item" },
      { status: 403 }
    );
  }

  const agora = new Date().toISOString();

  if (acao === "retry") {
    // Só volta para a fila quem falhou (ou quem foi feito à mão e precisa
    // ser reffeito). `criada` nunca reenvia: seria proposta duplicada na AXS.
    if (!["erro", "manual"].includes(item.status)) {
      return NextResponse.json(
        { error: "Só é possível tentar de novo itens com erro ou manuais", status_atual: item.status },
        { status: 409 }
      );
    }

    const { data: atualizado, error } = await admin
      .from("fila_propostas_axs")
      .update({
        status: "pendente",
        tentativas: 0,
        erro: null,
        proxima_tentativa: agora,
        ultima_tentativa_em: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !atualizado) {
      return NextResponse.json({ error: error?.message || "Falha ao reenfileirar" }, { status: 500 });
    }

    return NextResponse.json({ item: atualizado, acao });
  }

  // acao === "manual": feito fora do CRM; congela o item e avança o funil.
  if (["criada", "manual"].includes(item.status)) {
    return NextResponse.json(
      { error: "Item já está resolvido", status_atual: item.status },
      { status: 409 }
    );
  }

  const { data: atualizado, error } = await admin
    .from("fila_propostas_axs")
    .update({
      status: "manual",
      origem: "manual",
      erro: null,
      criada_em: agora,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !atualizado) {
    return NextResponse.json({ error: error?.message || "Falha ao marcar item" }, { status: 500 });
  }

  const avancou = await avancarFunil(admin, item.oportunidade_id, usuario.id);

  return NextResponse.json({ item: atualizado, acao, funil_avancado: avancou });
}
