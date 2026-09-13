/**
 * GET /api/atendimentos/page-data
 * 
 * Endpoint unificado que retorna TODOS os dados necessários para a página
 * de atendimento em uma única chamada. Elimina cold start cascata.
 * 
 * Retorna: atendimentos + etiquetas + instâncias + notificações + tarefas/resumo
 */

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const chatAtendimentoId = request.nextUrl.searchParams.get("atendimento_id");

    // Buscar perfil
    const { data: meuPerfil } = await supabaseAdmin
      .from("profiles")
      .select("cargo, whatsapp_instance, nome_completo, avatar_url")
      .eq("id", user.id)
      .single();

    const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
    const whatsappInstance = meuPerfil?.whatsapp_instance || null;

    // Query atendimentos com filtro adequado
    let query = supabaseAdmin
      .from("atendimentos")
      .select("*, clientes(id, nome_razao_social), ultima_mensagem_remetente, nao_lido")
      .order("ultima_mensagem_data", { ascending: false })
      .limit(200);

    if (isGestor) {
      // Gestores veem todos
    } else if (whatsappInstance) {
      query = query.eq("instancia", whatsappInstance);
    } else {
      const isDemo = (meuPerfil?.cargo || "") === "demonstracao";
      if (isDemo) {
        query = query.eq("vendedor_id", user.id);
      } else {
        query = query.or(`vendedor_id.eq.${user.id},vendedor_id.is.null`);
      }
    }

    // Query de mensagens (só se tiver chat aberto)
    const mensagensQuery = chatAtendimentoId
      ? supabaseAdmin
          .from("atendimento_mensagens")
          .select("*")
          .eq("atendimento_id", chatAtendimentoId)
          .order("created_at", { ascending: true })
      : null;

    // Executar queries em paralelo
    const settled = await Promise.allSettled([
      // 1. Atendimentos
      query,
      
      // 2. Etiquetas (batch)
      supabaseAdmin
        .from("atendimento_etiquetas")
        .select("atendimento_id, etiqueta")
        .then(({ data }) => {
          const mapa: Record<string, string[]> = {};
          (data || []).forEach((e: any) => {
            if (!mapa[e.atendimento_id]) mapa[e.atendimento_id] = [];
            mapa[e.atendimento_id].push(e.etiqueta);
          });
          return mapa;
        }),
      
      // 3. Instâncias WhatsApp
      fetch(`${process.env.EVOLUTION_API_URL || "http://2.25.192.248:8080"}/instance/fetchInstances`, {
        headers: { apikey: process.env.EVOLUTION_API_KEY || "" },
        signal: AbortSignal.timeout(5000),
      })
        .then(r => r.ok ? r.json() : [])
        .then((data: any) => (data || []).map((i: any) => ({
          id: i.id || "",
          name: i.name || "",
          number: i.number || "",
          status: i.state || "unknown",
        })))
        .catch(() => []),
      
      // 4. Notificações (count não lidas)
      supabaseAdmin
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, lida, created_at, dados")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      
      // 5. Tarefas resumo (silencioso se falhar)
      (async () => {
        try {
          const { data, error } = await supabaseAdmin
            .from("tarefas")
            .select("id, resultado, valor_venda, coluna_kanban, created_at")
            .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .lte("created_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString());
          if (error) return null;
          const tarefas = data || [];
          const sucesso = tarefas.filter((t: any) => t.resultado === "sucesso");
          return {
            total_vendas: sucesso.reduce((sum: number, t: any) => sum + (t.valor_venda || 0), 0),
            quantidade_vendas: sucesso.length,
            total_tarefas: tarefas.length,
          };
        } catch {
          return null;
        }
      })(),
      
      // 6. Mensagens do chat aberto (só se tiver atendimento_id)
      mensagensQuery,
    ]);

    // Montar resposta
    const atendimentos = settled[0].status === "fulfilled" ? (settled[0] as any).value?.data || [] : [];
    const etiquetas = settled[1].status === "fulfilled" ? (settled[1] as any).value || {} : {};
    const instancias = settled[2].status === "fulfilled" ? (settled[2] as any).value || [] : [];
    const notificacoes = settled[3].status === "fulfilled" ? (settled[3] as any).value?.data || [] : [];
    const naoLidas = notificacoes.filter((n: any) => !n.lida).length;
    const tarefasResumo = settled[4].status === "fulfilled" ? (settled[4] as any).value : null;
    const mensagensChat = settled[5]?.status === "fulfilled" ? (settled[5] as any).value?.data || [] : [];

    const elapsed = Date.now() - start;
    console.log(`[PageData] Loaded in ${elapsed}ms: ${atendimentos.length} atendimentos, ${instancias.length} instâncias, ${mensagensChat.length} msgs`);

    return NextResponse.json({
      atendimentos,
      etiquetas,
      instancias,
      notificacoes,
      naoLidas,
      tarefasResumo,
      mensagens: mensagensChat,
      perfil: {
        cargo: meuPerfil?.cargo,
        whatsapp_instance: whatsappInstance,
        nome_completo: meuPerfil?.nome_completo,
        avatar_url: meuPerfil?.avatar_url,
      },
      tempo_ms: elapsed,
    });
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`[PageData] Error (${elapsed}ms):`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
