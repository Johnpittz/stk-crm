/**
 * Webhook para receber mensagens do WhatsApp via WAHA (WhatsApp HTTP API)
 *
 * Endpoint: POST /api/webhooks/waha
 * Substitui app/api/webhooks/whatsapp/route.ts (Evolution API) — docs/plano-migracao-waha.md Fase 4.
 *
 * Eventos tratados (configurados na sessão WAHA):
 * - message.any   → cria/atualiza atendimento + insere mensagem (necessário para capturar
 *                   também o que o vendedor envia pelo celular; nunca trocar por "message")
 * - message.ack   → atualiza ack_status (best-effort; coluna opcional)
 * - session.status→ registra desconexão
 *
 * Fluxo (idêntico ao webhook da Evolution, trocando só o parser):
 * 1. Rate limit + token do webhook
 * 2. Parse normalizado (lib/waha-webhook.ts — testado com fixtures reais)
 * 3. Ignora grupos (@g.us) e mensagens vazias
 * 4. Dedup por whatsapp_message_id
 * 5. Mídia: baixa de media.url (resolverUrlMidia corrige localhost) → Supabase Storage bucket "media"
 * 6. Busca/cria atendimento por telefone + instancia (mesmo comportamento do antigo)
 * 7. Integração chatbot (gatilho, palavras de parada, reativação 24h)
 * 8. Integração IA (resposta automática via Gemini)
 *
 * A rota antiga (/api/webhooks/whatsapp) fica intacta como rollback até a Fase 10.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { telefoneParaDigitos } from "@/lib/telefone";
import { buscarVendedorPadrao } from "@/lib/roteamento";
import { uploadMediaToStorage } from "@/lib/media-storage";
import { gerarRespostaIA, verificarIAAtivada } from "@/lib/ai-assistant";
import { processarMensagemChatbot } from "@/lib/chatbot/engine";
import { resolveLidToPhone, saveLidMapping } from "@/lib/lid-resolver";
import { parseEventoWaha, montarConteudo, type MensagemWaha } from "@/lib/waha-webhook";
import { buscarNomeContato, enviarTexto, getWahaConfig, resolverLid, resolverUrlMidia } from "@/lib/waha";

export const dynamic = "force-dynamic";

// Cliente Supabase lazy (service_role para bypassar RLS)
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase URL e Service Role Key são obrigatórios");
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ==================== UPLOAD DE MÍDIA ====================

const MIME_POR_TIPO: Record<string, string> = {
  image: "image/jpeg",
  audio: "audio/ogg",
  video: "video/mp4",
  document: "application/octet-stream",
};

/**
 * Baixa a mídia do WAHA e faz upload para o Supabase Storage (bucket "media").
 * Sem decrypt (diferente da Evolution — o WAHA entrega o arquivo pronto).
 * A URL do evento pode vir como localhost → resolverUrlMidia normaliza para a base pública.
 */
async function processarMidia(m: MensagemWaha): Promise<string | null> {
  if (!m.tipo_midia) return null;

  try {
    const urlArquivo = await resolverUrlMidia({
      urlMidia: m.url_midia,
      telefone: m.telefone,
      messageId: m.whatsapp_message_id,
    });
    if (!urlArquivo) {
      console.error("[Webhook WAHA] Mídia sem URL resolvível (evento sem media.url e histórico sem fallback)");
      return null;
    }

    const resp = await fetch(urlArquivo, {
      headers: { "X-Api-Key": getWahaConfig().apiKey },
    });
    if (!resp.ok) {
      console.error(`[Webhook WAHA] Erro ao baixar mídia: HTTP ${resp.status}`);
      return null;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const mime = MIME_POR_TIPO[m.tipo_midia] || "application/octet-stream";
    // file_name como fallback de extensão: documento recebido chega como
    // application/octet-stream e virava .bin no Storage.
    return await uploadMediaToStorage(buffer.toString("base64"), mime, m.tipo_midia, m.file_name || undefined);
  } catch (err: any) {
    console.error("[Webhook WAHA] Erro processar mídia:", err.message);
    return null;
  }
}

/**
 * Extrai o timestamp original do payload WAHA (best-effort).
 * Evita que mensagens reenviadas/histórico caiam com created_at = agora.
 */
function extrairTimestamp(body: any): string | undefined {
  const ts = body?.payload?.timestamp ?? body?.payload?.messageTimestamp;
  if (!ts || typeof ts !== "number") return undefined;
  const ms = ts > 1e12 ? ts : ts * 1000;
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  return new Date(ms).toISOString();
}

// ==================== HANDLER PRINCIPAL ====================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit: 60 webhooks por minuto por IP
    const limit = rateLimit(request, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // 2. Token do webhook (query ?token= ou header X-Webhook-Token) — WAHA_WEBHOOK_TOKEN
    const webhookToken = process.env.WAHA_WEBHOOK_TOKEN;
    if (webhookToken) {
      const tokenRecebido =
        request.nextUrl.searchParams.get("token") || request.headers.get("X-Webhook-Token");
      if (tokenRecebido !== webhookToken) {
        return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }
    }

    // 3. Parse normalizado (lib/waha-webhook.ts — testado com fixtures)
    const body = await request.json();
    const evento = parseEventoWaha(body);

    if (evento.evento === "ignorado") {
      return NextResponse.json({ success: true, action: "ignored_event" });
    }

    // ==================== SESSION.STATUS ====================
    if (evento.evento === "session.status") {
      console.log(`[Webhook WAHA] Sessão ${evento.session}: ${evento.status}`);
      if (evento.status !== "WORKING") {
        console.warn(`[Webhook WAHA] ATENÇÃO: sessão ${evento.session} fora do ar (${evento.status})`);
      }
      return NextResponse.json({ success: true, action: "session_status" });
    }

    // ==================== MESSAGE.ACK ====================
    if (evento.evento === "message.ack") {
      // Best-effort: ignora se a coluna ack_status ainda não existir (Fase 9)
      await getSupabase()
        .from("atendimento_mensagens")
        .update({ ack_status: evento.ack })
        .eq("whatsapp_message_id", evento.whatsapp_message_id);
      return NextResponse.json({ success: true, action: "ack_updated" });
    }

    // ==================== MESSAGE ====================
    const dados = evento as MensagemWaha;

    // Ignorar mensagens de GRUPO
    if (dados.grupo) {
      console.log("[Webhook WAHA] Mensagem de grupo ignorada:", dados.telefone);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const sessionName = body?.session || getWahaConfig().session;

    // Resolve JIDs @lid para o número real (lição 1 do handoff) e persiste o mapeamento
    let telefoneLimpo = telefoneParaDigitos(dados.telefone);
    // dígitos do LID "cru" — usados para achar/fundir atendimentos criados
    // enquanto a resolução ainda falhava
    const telefoneLid = dados.de_lid ? telefoneParaDigitos(dados.telefone) : null;
    if (dados.de_lid) {
      const resolvido = await resolverLid(dados.jid);
      if (resolvido) {
        telefoneLimpo = telefoneParaDigitos(resolvido);
        await saveLidMapping(dados.jid, telefoneLimpo, sessionName, dados.nome);
      } else {
        const viaCache = await resolveLidToPhone(dados.jid, sessionName);
        if (viaCache) {
          telefoneLimpo = telefoneParaDigitos(viaCache);
        } else {
          console.warn(`[Webhook WAHA] LID sem mapeamento: ${dados.jid}`);
        }
      }
    }
    if (!telefoneLimpo) {
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const remetente = dados.from_me ? "vendedor" : "cliente";
    const naoLido = dados.from_me ? false : true;
    const conteudoMensagem = montarConteudo(dados);
    const temMidia = dados.tipo_midia !== null;
    const nomeCliente = dados.nome || null;
    const createdAt = extrairTimestamp(body);

    if (!conteudoMensagem && !temMidia) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    // ==================== DEDUP ====================
    if (dados.whatsapp_message_id) {
      const { data: jaExiste } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id")
        .eq("whatsapp_message_id", dados.whatsapp_message_id)
        .limit(1);
      if (jaExiste && jaExiste.length > 0) {
        console.log(`[Webhook WAHA] Mensagem duplicada (wa_id=${dados.whatsapp_message_id}), ignorando`);
        return NextResponse.json({ success: true, action: "duplicate" });
      }
    }

    // ============ FUSÃO DE ATENDIMENTO LID ============
    // Se a resolução do LID só passou a funcionar agora, o atendimento criado
    // com o número "cru" é fundido no atendimento do telefone real.
    if (telefoneLid && telefoneLid !== telefoneLimpo) {
      await fundirAtendimentoDeLid(telefoneLid, telefoneLimpo, sessionName);
    }

    // ============ NOME (fallback: contato do WhatsApp) ============
    // pushName nem sempre vem (especialmente em LIDs); se o cadastro não tem
    // nome, pergunta ao WAHA antes de cair no "Cliente".
    let nomeContatoWa: string | null = null;
    if (!dados.from_me && !nomeCliente) {
      const alvoNome = telefoneLid && telefoneLid === telefoneLimpo ? dados.jid : telefoneLimpo;
      nomeContatoWa = await buscarNomeContato(alvoNome);
    }

    // ==================== MÍDIA ====================
    let mediaUrlFinal: string | null = null;
    if (temMidia) {
      mediaUrlFinal = await processarMidia(dados);
      if (dados.midia_erro) {
        console.warn(`[Webhook WAHA] Mídia com erro no WAHA: ${dados.midia_erro}`);
      }
    }

    // ==================== BUSCA CLIENTE / ATENDIMENTO ====================
    const cliente = await buscarClientePorTelefone(telefoneLimpo);
    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo, sessionName);

    // Dedup por CONTEÚDO (eco fromMe): a rota de envio insere a linha sem o
    // whatsapp_message_id, envia e só depois grava o id — o eco do WAHA costuma
    // chegar nessa janela e o dedup por id não acha nada → linha duplicada.
    // Só para saída própria, com candidato recente (≤60s) e id vazio/igual.
    if (atendimentoExistente && dados.from_me && dados.whatsapp_message_id && conteudoMensagem) {
      const { data: candidatos } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id, whatsapp_message_id, created_at")
        .eq("atendimento_id", atendimentoExistente.id)
        .eq("remetente", "vendedor")
        .eq("conteudo", conteudoMensagem)
        .order("created_at", { ascending: false })
        .limit(5);
      const base = createdAt ? new Date(createdAt).getTime() : Date.now();
      const eco = (candidatos || []).find((c: any) => {
        const ts = c.created_at ? new Date(c.created_at).getTime() : 0;
        if (!ts || Math.abs(base - ts) > 60_000) return false;
        return !c.whatsapp_message_id || c.whatsapp_message_id === dados.whatsapp_message_id;
      });
      if (eco) {
        return NextResponse.json({ received: true, action: "duplicate_content" });
      }
    }

    if (atendimentoExistente) {
      // Se atendimento não tem vendedor, tenta atribuir (cliente ou padrão)
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || (await buscarVendedorPadrao()) || null;
        console.log(`[Webhook WAHA] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
      }

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: remetente,
          nao_lido: naoLido,
          // Só atualiza nome se veio do CLIENTE (pushName do operador é o próprio nome);
          // sem pushName, preenche com o contato do WAHA só se ainda estiver genérico
          ...(() => {
            if (dados.from_me) return {};
            const nomeAtual = atendimentoExistente.nome_cliente;
            const efetivo =
              nomeCliente ||
              (nomeContatoWa && (!nomeAtual || nomeAtual === "Cliente") ? nomeContatoWa : null);
            return efetivo ? { nome_cliente: efetivo } : {};
          })(),
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
          instancia: sessionName || atendimentoExistente.instancia || "STK-3",
        })
        .eq("id", atendimentoExistente.id);

      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: remetente,
        conteudo: conteudoMensagem,
        enviada_por: dados.from_me ? (vendedorUpdate || null) : null,
        media_url: mediaUrlFinal,
        media_type: dados.tipo_midia,
        media_key: null, // WAHA entrega mídia já descriptografada
        file_name: dados.file_name || null,
        whatsapp_message_id: dados.whatsapp_message_id || null,
        ...(createdAt ? { created_at: createdAt } : {}),
      });

      console.log(`[Webhook WAHA] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);

      // ===== INTEGRAÇÃO CHATBOT =====
      if (!dados.from_me && conteudoMensagem) {
        try {
          const acao = await integrarChatbot({
            telefoneLimpo,
            mensagem: conteudoMensagem,
            instancia: sessionName || "STK-3",
            nomeCliente: nomeCliente || undefined,
            verificarSessaoAtiva: true,
          });
          if (acao) {
            if (acao === "chatbot_fora_horario") {
              return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: acao });
            }
            return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: acao });
          }
        } catch (err: any) {
          console.error("[Chatbot] Erro:", err.message);
        }
      }

      // ===== INTEGRAÇÃO IA =====
      if (!dados.from_me && conteudoMensagem) {
        const iaAtivada = await verificarIAAtivada(getSupabase());
        if (iaAtivada) {
          try {
            const { data: historico } = await getSupabase()
              .from("atendimento_mensagens")
              .select("remetente, conteudo")
              .eq("atendimento_id", atendimentoExistente.id)
              .order("created_at", { ascending: true })
              .limit(20);

            const respostaIA = await gerarRespostaIA({
              mensagemCliente: conteudoMensagem,
              nomeCliente: nomeCliente || undefined,
              historico: historico || [],
            });

            if (respostaIA) {
              const resultado = await enviarTexto({
                telefone: telefoneLimpo,
                mensagem: respostaIA,
                session: sessionName || undefined,
              });

              if (resultado.success) {
                console.log(`[Webhook WAHA] IA respondeu para ${telefoneLimpo}: ${respostaIA.substring(0, 50)}...`);
                await getSupabase().from("atendimento_mensagens").insert({
                  atendimento_id: atendimentoExistente.id,
                  remetente: "vendedor",
                  conteudo: respostaIA,
                  enviada_por: null, // IA não é um vendedor específico
                  whatsapp_message_id: resultado.message_id || null,
                });
              } else {
                console.error(`[Webhook WAHA] Erro ao enviar resposta IA:`, resultado.error);
              }
            }
          } catch (err: any) {
            console.error("[Webhook WAHA] Erro na integração IA:", err.message);
          }
        }
      }

      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // ==================== NOVO ATENDIMENTO ====================
    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;

    console.log(`[Webhook WAHA] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        // Só usa pushName/contato do WAHA se veio do CLIENTE; senão cadastro ou "Cliente"
        nome_cliente: (!dados.from_me && (nomeCliente || nomeContatoWa)) || cliente?.nome_razao_social || "Cliente",
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: remetente,
        nao_lido: naoLido,
        instancia: sessionName || "STK-3",
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WAHA] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: remetente,
      conteudo: conteudoMensagem,
      enviada_por: dados.from_me ? (vendedorFinal || null) : null,
      media_url: mediaUrlFinal,
      media_type: dados.tipo_midia,
      media_key: null,
      file_name: dados.file_name || null,
      whatsapp_message_id: dados.whatsapp_message_id || null,
      ...(createdAt ? { created_at: createdAt } : {}),
    });

    console.log(`[Webhook WAHA] Novo atendimento criado: ${novoAtendimento.id}`);

    // ===== INTEGRAÇÃO CHATBOT (novo atendimento) =====
    if (!dados.from_me && conteudoMensagem) {
      try {
        const acao = await integrarChatbot({
          telefoneLimpo,
          mensagem: conteudoMensagem,
          instancia: sessionName || "STK-3",
          nomeCliente: nomeCliente || undefined,
          verificarSessaoAtiva: false,
        });
        if (acao) {
          return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: acao });
        }
      } catch (err: any) {
        console.error("[Chatbot] Erro (novo):", err.message);
      }
    }

    // ===== INTEGRAÇÃO IA (novo atendimento) =====
    if (!dados.from_me && conteudoMensagem) {
      const iaAtivada = await verificarIAAtivada(getSupabase());
      if (iaAtivada) {
        try {
          const respostaIA = await gerarRespostaIA({
            mensagemCliente: conteudoMensagem,
            nomeCliente: nomeCliente || undefined,
          });

          if (respostaIA) {
            const resultado = await enviarTexto({
              telefone: telefoneLimpo,
              mensagem: respostaIA,
              session: sessionName || undefined,
            });

            if (resultado.success) {
              console.log(`[Webhook WAHA] IA respondeu (novo atendimento) para ${telefoneLimpo}`);
              await getSupabase().from("atendimento_mensagens").insert({
                atendimento_id: novoAtendimento.id,
                remetente: "vendedor",
                conteudo: respostaIA,
                enviada_por: null,
                whatsapp_message_id: resultado.message_id || null,
              });
            }
          }
        } catch (err: any) {
          console.error("[Webhook WAHA] Erro IA (novo atendimento):", err.message);
        }
      }
    }

    return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "created" });
  } catch (error: any) {
    console.error("[Webhook WAHA] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== INTEGRAÇÃO CHATBOT ====================

/**
 * Fluxo de ativação do chatbot — port fiel do webhook da Evolution:
 * - sessão ativa → processa a mensagem (só quando verificarSessaoAtiva, caso do atendimento existente)
 * - sessão concluída/encaminhada → nunca reativa ("already_completed")
 * - sessão cancelada nas últimas 24h → bloqueada ("blocked_cancelled")
 * - fluxo ativo + gatilho (todos | disparo) → inicia/processa
 * Retorna a action ou null se o chatbot não deve responder.
 */
async function integrarChatbot(params: {
  telefoneLimpo: string;
  mensagem: string;
  instancia: string;
  nomeCliente?: string;
  verificarSessaoAtiva: boolean;
}): Promise<string | null> {
  const { telefoneLimpo, mensagem, instancia, nomeCliente, verificarSessaoAtiva } = params;

  if (verificarSessaoAtiva) {
    const { data: sessaoChatbot } = await getSupabase()
      .from("chatbot_sessions")
      .select("*")
      .eq("telefone", telefoneLimpo)
      .eq("status", "ativa")
      .maybeSingle();

    if (sessaoChatbot) {
      await processarMensagemChatbot(telefoneLimpo, mensagem, instancia, nomeCliente);
      return "chatbot";
    }
  }

  // Sessão já finalizada — não reativar
  const { data: sessaoFinalizada } = await getSupabase()
    .from("chatbot_sessions")
    .select("id")
    .eq("telefone", telefoneLimpo)
    .in("status", ["concluida", "encaminhada"])
    .limit(1)
    .maybeSingle();

  if (sessaoFinalizada) {
    return "already_completed";
  }

  // Cancelada nas últimas 24h — não reativar
  const { data: sessaoCancelada } = await getSupabase()
    .from("chatbot_sessions")
    .select("id")
    .eq("telefone", telefoneLimpo)
    .eq("status", "cancelada")
    .gte("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (sessaoCancelada) {
    return "blocked_cancelled";
  }

  const { data: fluxoChatbot } = await getSupabase()
    .from("chatbot_flows")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fluxoChatbot) return null;

  // Gatilho: 'disparo' só ativa para números na tabela de gatilho
  let podeAtivar = fluxoChatbot.gatilho === "todos";
  if (fluxoChatbot.gatilho === "disparo") {
    const { data: noGatilho } = await getSupabase()
      .from("chatbot_gatilho_numeros")
      .select("id")
      .eq("flow_id", fluxoChatbot.id)
      .eq("telefone", telefoneLimpo)
      .maybeSingle();
    podeAtivar = !!noGatilho;
  }

  if (!podeAtivar) return null;

  const resultadoChatbot = await processarMensagemChatbot(
    telefoneLimpo,
    mensagem,
    instancia || fluxoChatbot.instancia || "STK-3",
    nomeCliente
  );
  console.log(`[Chatbot] Resultado: ${resultadoChatbot.action}`);
  if (resultadoChatbot.action === "fora_horario") {
    return "chatbot_fora_horario";
  }
  return "chatbot_started";
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Busca cliente pelo telefone no banco de dados
 */
async function buscarClientePorTelefone(telefoneLimpo: string) {
  const { data: clientesCandidatos } = await getSupabase()
    .from("clientes")
    .select("id, vendedor_responsavel_id, nome_razao_social, telefone, celular")
    .or(`telefone.ilike.%${telefoneLimpo.substring(0, 6)}%,celular.ilike.%${telefoneLimpo.substring(0, 6)}%`)
    .limit(50);

  if (!clientesCandidatos || clientesCandidatos.length === 0) return null;

  // Filtra comparando só dígitos
  return clientesCandidatos.find((c: any) => {
    const telLimpo = (c.telefone || "").replace(/\D/g, "");
    const celLimpo = (c.celular || "").replace(/\D/g, "");
    return (
      telLimpo === telefoneLimpo ||
      celLimpo === telefoneLimpo ||
      telLimpo.endsWith(telefoneLimpo) ||
      celLimpo.endsWith(telefoneLimpo) ||
      telefoneLimpo.endsWith(telLimpo) ||
      telefoneLimpo.endsWith(celLimpo)
    );
  }) || null;
}

/**
 * Busca atendimento aberto existente para o telefone + instância
 * Cada instância WhatsApp mantém atendimentos separados (mesma regra do webhook antigo)
 */
/**
 * Quando um LID finalmente resolve, um atendimento que tenha sido criado com
 * os dígitos do LID (resolução falhou na 1ª mensagem) é fundido no atendimento
 * do telefone real: mensagens movidas (sem duplicar ids do WhatsApp) e a linha
 * LID apagada. Sem ação quando não existe atendimento LID.
 */
async function fundirAtendimentoDeLid(
  lidDigits: string,
  telefone: string,
  instancia: string | null
) {
  if (!telefone || lidDigits === telefone) return;
  const supa = getSupabase();

  const qLid = supa.from("atendimentos").select("id").eq("telefone_cliente", lidDigits);
  if (instancia) qLid.eq("instancia", instancia);
  const { data: lidRows } = await qLid.limit(5);
  if (!lidRows || lidRows.length === 0) return;

  const qAlvo = supa
    .from("atendimentos")
    .select("id")
    .eq("telefone_cliente", telefone)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: alvoRows } = await qAlvo;
  const alvoId: string | null = alvoRows && alvoRows[0] && !lidRows.some((l: any) => l.id === alvoRows[0].id)
    ? alvoRows[0].id
    : null;

  for (const lid of lidRows) {
    if (!alvoId) {
      // não existe atendimento no telefone real → só rechaveia a linha
      await supa.from("atendimentos").update({ telefone_cliente: telefone }).eq("id", lid.id);
      console.log(`[Webhook WAHA] Atendimento LID ${lid.id} rechaveado para ${telefone}`);
      continue;
    }

    // ids do WhatsApp já presentes no alvo (dedup antes de mover)
    const { data: alvoMsgs } = await supa
      .from("atendimento_mensagens")
      .select("whatsapp_message_id")
      .eq("atendimento_id", alvoId)
      .limit(5000);
    const idsAlvo = new Set(
      ((alvoMsgs || []).map((m: any) => m.whatsapp_message_id).filter(Boolean) as string[]).map(
        (id) => id.toLowerCase().slice(-28)
      )
    );

    const { data: lidMsgs } = await supa
      .from("atendimento_mensagens")
      .select("id, whatsapp_message_id")
      .eq("atendimento_id", lid.id)
      .limit(5000);

    const duplicadas = (lidMsgs || [])
      .filter((m: any) => m.whatsapp_message_id && idsAlvo.has(m.whatsapp_message_id.toLowerCase().slice(-28)))
      .map((m: any) => m.id);
    if (duplicadas.length > 0) {
      await supa.from("atendimento_mensagens").delete().in("id", duplicadas);
    }

    // move as mensagens restantes e apaga a linha LID
    await supa
      .from("atendimento_mensagens")
      .update({ atendimento_id: alvoId })
      .eq("atendimento_id", lid.id);
    await supa.from("atendimentos").delete().eq("id", lid.id);
    console.log(
      `[Webhook WAHA] LID ${lidDigits} fundido em ${telefone}: ` +
      `${(lidMsgs || []).length - duplicadas.length} mensagens movidas, ${duplicadas.length} duplicadas descartadas`
    );
  }
}

async function buscarAtendimentoAberto(telefoneLimpo: string, instancia: string | null) {
  const query = getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, instancia")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto");

  if (instancia) {
    query.eq("instancia", instancia);
  }

  const { data: exato } = await query.limit(1).single();
  if (exato) return exato;

  // Segundo: busca ampla — compara apenas os últimos 8 dígitos
  const ultimos8 = telefoneLimpo.slice(-8);
  if (ultimos8.length < 8) return null;

  const queryAmpla = getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente, instancia")
    .eq("status", "aberto");

  if (instancia) {
    queryAmpla.eq("instancia", instancia);
  }

  const { data: candidatos } = await queryAmpla
    .order("ultima_mensagem_data", { ascending: false })
    .limit(50);

  if (!candidatos || candidatos.length === 0) return null;

  const encontrado = candidatos.find((a: any) => {
    const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
    const ultimos8Banco = telBanco.slice(-8);
    return ultimos8Banco === ultimos8 && ultimos8Banco.length >= 8;
  });

  return encontrado || null;
}
