import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AXS_BASE_URL = "https://iris.axsenergia.com.br";

/**
 * POST /api/axs/sync
 *
 * Body: { cliente_id: string, email: string, senha: string }
 *
 * 1. Logs into AXS API with the provided credentials
 * 2. Fetches proposals for the representative
 * 3. Saves axs_card_id and axs_status to the client in Supabase
 * 4. Upserts AXS proposal records in supabase
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { cliente_id, email, senha } = body;

  if (!cliente_id || !email || !senha) {
    return NextResponse.json(
      { error: "cliente_id, email e senha são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // ─── Step 1: Login into AXS ───
    const loginRes = await fetch(`${AXS_BASE_URL}/csp/representante/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    if (!loginRes.ok) {
      const loginText = await loginRes.text();
      console.error("[AXS Sync] Login falhou:", loginRes.status, loginText);
      return NextResponse.json(
        { error: "Falha no login AXS. Verifique as credenciais." },
        { status: 401 }
      );
    }

    const loginData = await loginRes.json();
    const accessToken = loginData.acessToken || loginData.accessToken || loginData.token;

    if (!accessToken) {
      console.error("[AXS Sync] Token não encontrado na resposta:", loginData);
      return NextResponse.json(
        { error: "Token AXS não encontrado na resposta de login" },
        { status: 500 }
      );
    }

    // ─── Step 2: Fetch proposals from AXS ───
    // The list endpoint - fetch all cards/proposals for the representative
    const proposalsRes = await fetch(
      `${AXS_BASE_URL}/csp/representante/v2/cards/consultar`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!proposalsRes.ok) {
      const proposalsText = await proposalsRes.text();
      console.error(
        "[AXS Sync] Erro ao buscar propostas:",
        proposalsRes.status,
        proposalsText
      );
      return NextResponse.json(
        { error: "Falha ao buscar propostas na API AXS" },
        { status: 502 }
      );
    }

    const proposalsData = await proposalsRes.json();

    // Handle both array and paginated response shapes
    let proposals: any[] = [];
    if (Array.isArray(proposalsData)) {
      proposals = proposalsData;
    } else if (Array.isArray(proposalsData.cards)) {
      proposals = proposalsData.cards;
    } else if (Array.isArray(proposalsData.data)) {
      proposals = proposalsData.data;
    } else if (Array.isArray(proposalsData.propostas)) {
      proposals = proposalsData.propostas;
    }

    console.log(`[AXS Sync] ${proposals.length} propostas encontradas`);

    // ─── Step 3: Get client info ───
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nome_razao_social, cpf_cnpj, email, telefone, cidade, estado")
      .eq("id", cliente_id)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // ─── Step 4: Match proposals to client ───
    // Try to find matching proposals by CPF/CNPJ, email, or name
    const documento = cliente.cpf_cnpj?.replace(/\D/g, "") || "";
    const clienteEmail = cliente.email?.toLowerCase().trim() || "";
    const clienteNome = cliente.nome_razao_social?.toLowerCase().trim() || "";

    let matchedProposals: any[] = [];
    let updatedCount = 0;

    for (const proposal of proposals) {
      const propDoc = (
        proposal.cpf ||
        proposal.cnpj ||
        proposal.documento ||
        proposal.cpfCnpj ||
        ""
      )
        .replace(/\D/g, "");
      const propEmail = (
        proposal.email ||
        proposal.emailCliente ||
        ""
      ).toLowerCase().trim();
      const propNome = (
        proposal.nome ||
        proposal.nomeCliente ||
        proposal.razaoSocial ||
        ""
      ).toLowerCase().trim();

      const cardId =
        proposal.idCard ||
        proposal.id_card ||
        proposal.cardId ||
        proposal.id ||
        proposal.codigo;
      const status =
        proposal.status ||
        proposal.situacao ||
        proposal.estado ||
        "desconhecido";
      const mensalidade =
        proposal.mensalidade ||
        proposal.valorMensalidade ||
        proposal.valor_mensalidade ||
        null;

      // Match logic: try document first, then email, then name
      let matched = false;
      if (documento && propDoc && propDoc === documento) matched = true;
      if (clienteEmail && propEmail && propEmail === clienteEmail) matched = true;
      if (
        clienteNome &&
        propNome &&
        (propNome.includes(clienteNome) || clienteNome.includes(propNome))
      )
        matched = true;

      if (matched && cardId) {
        matchedProposals.push({
          card_id: String(cardId),
          status: String(status),
          mensalidade: mensalidade ? Number(mensalidade) : null,
          dados: proposal,
        });
      }
    }

    // ─── Step 5: Update client and save proposals ───
    if (matchedProposals.length > 0) {
      const firstMatch = matchedProposals[0];

      // Update client with AXS data
      const { error: updateError } = await supabase
        .from("clientes")
        .update({
          axs_card_id: firstMatch.card_id,
          axs_status: firstMatch.status,
          axs_mensalidade: firstMatch.mensalidade,
        })
        .eq("id", cliente_id);

      if (updateError) {
        console.error("[AXS Sync] Erro ao atualizar cliente:", updateError);
        // Continue anyway to try saving proposals
      } else {
        updatedCount = 1;
      }

      // Save/update proposals in supabase
      for (const match of matchedProposals) {
        try {
          await supabase.from("axs_propostas").upsert(
            {
              cliente_id,
              axs_card_id: match.card_id,
              axs_status: match.status,
              axs_mensalidade: match.mensalidade,
              axs_dados: match.dados,
              vendedor_id: user.id,
            },
            { onConflict: "cliente_id,axs_card_id" }
          );
        } catch (err: any) {
          console.warn(
            "[AXS Sync] Erro ao salvar proposta:",
            err?.message || err
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message:
        matchedProposals.length > 0
          ? `${matchedProposals.length} proposta(s) encontrada(s) e sincronizada(s)`
          : "Nenhuma proposta correspondente encontrada para este cliente",
      total_propostas_axs: proposals.length,
      propostas_encontradas: matchedProposals.length,
      cliente_atualizado: updatedCount > 0,
      propostas: matchedProposals.map((m) => ({
        card_id: m.card_id,
        status: m.status,
        mensalidade: m.mensalidade,
      })),
    });
  } catch (err: any) {
    console.error("[AXS Sync] Erro geral:", err);
    return NextResponse.json(
      { error: "Erro interno ao sincronizar com AXS" },
      { status: 500 }
    );
  }
}
