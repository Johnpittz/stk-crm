/**
 * Webhook para receber mensagens do WhatsApp via Evolution API
 * 
 * Endpoint: POST /api/webhooks/whatsapp
 * 
 * Quando um cliente envia mensagem no WhatsApp, a Evolution API envia
 * um payload para este endpoint. O sistema:
 * 1. Identifica/cria o atendimento pelo telefone
 * 2. Insere a mensagem no chat (com suporte a mídia)
 * 3. Atualiza o status do atendimento
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { telefoneParaDigitos, enviarMensagemWhatsApp } from "@/lib/evolution-api";
import { buscarVendedorPadrao } from "@/lib/roteamento";
import { uploadMediaToStorage } from "@/lib/media-storage";
import { gerarRespostaIA, verificarIAAtivada } from "@/lib/ai-assistant";
import { processarMensagemChatbot } from "@/lib/chatbot/engine";

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

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 60 webhooks por minuto
    const limit = rateLimit(request, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // Parse do payload da Evolution API
    const payload = await request.json();

    // Log para debug
    console.log("[Webhook WhatsApp] Evento:", payload.event);
    console.log("[Webhook WhatsApp] Instance:", payload.instance);
    
    // Log detalhado do payload para debug de mídia
    if (payload.data?.message) {
      const msg = payload.data.message;
      const hasBase64 = !!msg.base64;
      const mediaTypes = ['imageMessage', 'audioMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];
      const foundMedia = mediaTypes.find(t => msg[t]);
      console.log("[Webhook WhatsApp] hasBase64:", hasBase64, "| mediaType:", foundMedia || "none");
      if (hasBase64) {
        console.log("[Webhook WhatsApp] base64 length:", msg.base64.length);
      }
    }

    // Extrair dados do payload da Evolution API
    const dados = extrairDadosEvolutionAPI(payload);

    // Se tem base64 raw, faz upload para Supabase Storage (evita egress no banco)
    if (dados.rawBase64 && dados.rawMime && dados.mediaType) {
      const prefix = dados.mediaType === "audio" ? "audio"
        : dados.mediaType === "video" ? "video"
        : dados.mediaType === "sticker" ? "sticker"
        : "image";
      const publicUrl = await uploadMediaToStorage(dados.rawBase64, dados.rawMime, prefix);
      if (publicUrl) {
        dados.mediaUrl = publicUrl;
        console.log(`[Webhook WhatsApp] Mídia salva no Storage: ${publicUrl}`);
      } else {
        console.error("[Webhook WhatsApp] Falha ao salvar mídia no Storage");
      }
      dados.rawBase64 = null;
    }

    // Ignorar mensagens de GRUPO (remoteJid termina em @g.us)
    if (dados.remoteJid && dados.remoteJid.endsWith("@g.us")) {
      console.log("[Webhook WhatsApp] Mensagem de grupo ignorada:", dados.remoteJid);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      console.error("[Webhook WhatsApp] Telefone não encontrado no payload");
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const telefoneLimpo = telefoneParaDigitos(dados.telefone);
    const mensagem = dados.mensagem || "";
    const nomeCliente = dados.nome || null;

    // Verificar se tem mídia
    const temMidia = dados.mediaType !== null;
    const conteudoMensagem = temMidia ? `[${dados.mediaType}]` : mensagem;

    // Aceita mensagens vazias se tiver mídia
    if (!conteudoMensagem && !temMidia) {
      console.error("[Webhook WhatsApp] Mensagem vazia e sem mídia");
      return NextResponse.json(
        { error: "Mensagem vazia" },
        { status: 400 }
      );
    }

    // 1. Busca cliente pelo telefone
    const cliente = await buscarClientePorTelefone(telefoneLimpo);

    // 2. Busca atendimento aberto existente para este telefone + instância
    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo, dados.instance);

    if (atendimentoExistente) {
      // Se atendimento não tem vendedor, tenta atribuir (cliente ou padrão)
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || await buscarVendedorPadrao() || null;
        console.log(`[Webhook WhatsApp] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
      }

      const remetente = dados.fromMe ? "vendedor" : "cliente";
      const naoLido = dados.fromMe ? false : true;

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: remetente,
          nao_lido: naoLido,
          // Só atualiza nome se veio do CLIENTE (pushName do operador é o próprio nome)
          ...(nomeCliente && !dados.fromMe ? { nome_cliente: nomeCliente } : {}),
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
          instancia: dados.instance || atendimentoExistente.instancia || "minha-conexao",
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat com mídia (usa whatsapp_message_id para dedup)
      const waMsgId = dados.messageId || null;
      if (waMsgId) {
        const { data: jaExiste } = await getSupabase()
          .from("atendimento_mensagens")
          .select("id")
          .eq("whatsapp_message_id", waMsgId)
          .limit(1);
        if (jaExiste && jaExiste.length > 0) {
          console.log(`[Webhook WhatsApp] Mensagem duplicada (wa_id=${waMsgId}), ignorando`);
          return NextResponse.json({ success: true, action: "duplicate" });
        }
      }
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: remetente,
        conteudo: conteudoMensagem,
        enviada_por: dados.fromMe ? (vendedorUpdate || null) : null,
        media_url: dados.mediaUrl || null,
        media_type: dados.mediaType || null,
        file_name: dados.fileName || null,
        whatsapp_message_id: waMsgId,
      });

      console.log(`[Webhook WhatsApp] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);

      // ===== INTEGRAÇÃO CHATBOT =====
      if (!dados.fromMe && mensagem) {
        try {
          // Verificar se há sessão ativa
          const { data: sessaoChatbot } = await getSupabase()
            .from('chatbot_sessions')
            .select('*')
            .eq('telefone', telefoneLimpo)
            .eq('status', 'ativa')
            .maybeSingle();

          if (sessaoChatbot) {
            await processarMensagemChatbot(telefoneLimpo, mensagem, dados.instance || 'STK', nomeCliente || undefined);
            return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "chatbot" });
          }

          // Verificar se já recebeu o script antes (concluída/encaminhada) — não reativar
          const { data: sessaoFinalizada } = await getSupabase()
            .from('chatbot_sessions')
            .select('id')
            .eq('telefone', telefoneLimpo)
            .in('status', ['concluida', 'encaminhada'])
            .limit(1)
            .maybeSingle();

          if (sessaoFinalizada) {
            return NextResponse.json({ success: true, action: "already_completed" });
          }

          // Verificar se foi cancelada nas últimas 24h (não reativar)
          const { data: sessaoCancelada } = await getSupabase()
            .from('chatbot_sessions')
            .select('id')
            .eq('telefone', telefoneLimpo)
            .eq('status', 'cancelada')
            .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1)
            .maybeSingle();

          if (sessaoCancelada) {
            return NextResponse.json({ success: true, action: "blocked_cancelled" });
          }

          const { data: fluxoChatbot } = await getSupabase()
            .from('chatbot_flows')
            .select('*')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fluxoChatbot) {
            // Checar gatilho: se 'disparo', só ativa pra números na tabela
            let podeAtivar = fluxoChatbot.gatilho === 'todos';
            if (fluxoChatbot.gatilho === 'disparo') {
              const { data: noGatilho } = await getSupabase()
                .from('chatbot_gatilho_numeros')
                .select('id')
                .eq('flow_id', fluxoChatbot.id)
                .eq('telefone', telefoneLimpo)
                .maybeSingle();
              podeAtivar = !!noGatilho;
            }

            if (podeAtivar) {
              await processarMensagemChatbot(telefoneLimpo, mensagem, dados.instance || fluxoChatbot.instancia || 'STK', nomeCliente || undefined);
              return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "chatbot_started" });
            }
          }
        } catch (err: any) {
          console.error('[Chatbot] Erro:', err.message);
        }
      }
      // ===== FIM INTEGRAÇÃO CHATBOT =====

      // ===== INTEGRAÇÃO IA =====
      // Se a IA está ativada e a mensagem é do cliente, gera e envia resposta automática
      if (!dados.fromMe && mensagem) {
        const iaAtivada = await verificarIAAtivada(getSupabase());
        if (iaAtivada) {
          try {
            // Buscar histórico recente do atendimento
            const { data: historico } = await getSupabase()
              .from('atendimento_mensagens')
              .select('remetente, conteudo')
              .eq('atendimento_id', atendimentoExistente.id)
              .order('created_at', { ascending: true })
              .limit(20);

            // Gerar resposta da IA
            const respostaIA = await gerarRespostaIA({
              mensagemCliente: mensagem,
              nomeCliente: nomeCliente || undefined,
              historico: historico || [],
            });

            if (respostaIA) {
              // Enviar resposta via Evolution API
              const resultado = await enviarMensagemWhatsApp({
                telefone: telefoneLimpo,
                mensagem: respostaIA,
                instance: dados.instance || undefined,
              });

              if (resultado.success) {
                console.log(`[Webhook WhatsApp] IA respondeu para ${telefoneLimpo}: ${respostaIA.substring(0, 50)}...`);
                // Salvar resposta da IA no chat
                await getSupabase().from('atendimento_mensagens').insert({
                  atendimento_id: atendimentoExistente.id,
                  remetente: 'vendedor',
                  conteudo: respostaIA,
                  enviada_por: null, // IA não é um vendedor específico
                  whatsapp_message_id: resultado.message_id,
                });
              } else {
                console.error(`[Webhook WhatsApp] Erro ao enviar resposta IA:`, resultado.error);
              }
            }
          } catch (err: any) {
            console.error('[Webhook WhatsApp] Erro na integração IA:', err.message);
          }
        }
      }
      // ===== FIM INTEGRAÇÃO IA =====

      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // 3. Cria novo atendimento
    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;
    const remetente = dados.fromMe ? "vendedor" : "cliente";
    
    console.log(`[Webhook WhatsApp] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        // Só usa pushName se veio do CLIENTE; operador = "Cliente" ou nome do cadastro
        nome_cliente: (!dados.fromMe && nomeCliente) || cliente?.nome_razao_social || "Cliente",
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: remetente,
        nao_lido: !dados.fromMe,
        instancia: dados.instance || "minha-conexao",
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WhatsApp] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    // 4. Insere mensagem inicial no chat com mídia (com dedup)
    const waMsgId2 = dados.messageId || null;
    if (waMsgId2) {
      const { data: jaExiste2 } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id")
        .eq("whatsapp_message_id", waMsgId2)
        .limit(1);
      if (jaExiste2 && jaExiste2.length > 0) {
        console.log(`[Webhook WhatsApp] Mensagem duplicada (wa_id=${waMsgId2}), ignorando`);
        return NextResponse.json({ success: true, action: "duplicate" });
      }
    }
    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: remetente,
      conteudo: conteudoMensagem,
      enviada_por: dados.fromMe ? (vendedorFinal || null) : null,
      media_url: dados.mediaUrl || null,
      media_type: dados.mediaType || null,
      file_name: dados.fileName || null,
      whatsapp_message_id: waMsgId2,
    });

    console.log(`[Webhook WhatsApp] Novo atendimento criado: ${novoAtendimento.id}`);

    // ===== INTEGRAÇÃO CHATBOT (novo atendimento) =====
    if (!dados.fromMe && mensagem) {
      try {
        // Verificar se já recebeu o script antes (concluída/encaminhada) — não reativar
        const { data: sessaoFinalizadaNovo } = await getSupabase()
          .from('chatbot_sessions')
          .select('id')
          .eq('telefone', telefoneLimpo)
          .in('status', ['concluida', 'encaminhada'])
          .limit(1)
          .maybeSingle();

        if (sessaoFinalizadaNovo) {
          return NextResponse.json({ success: true, action: "already_completed" });
        }

        // Verificar se foi cancelada nas últimas 24h
        const { data: sessaoCanceladaNovo } = await getSupabase()
          .from('chatbot_sessions')
          .select('id')
          .eq('telefone', telefoneLimpo)
          .eq('status', 'cancelada')
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (sessaoCanceladaNovo) {
          return NextResponse.json({ success: true, action: "blocked_cancelled" });
        }

        const { data: fluxoChatbotNovo } = await getSupabase()
          .from('chatbot_flows')
          .select('*')
          .eq('ativo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fluxoChatbotNovo) {
          let podeAtivar = fluxoChatbotNovo.gatilho === 'todos';
          if (fluxoChatbotNovo.gatilho === 'disparo') {
            const { data: noGatilho } = await getSupabase()
              .from('chatbot_gatilho_numeros')
              .select('id')
              .eq('flow_id', fluxoChatbotNovo.id)
              .eq('telefone', telefoneLimpo)
              .maybeSingle();
            podeAtivar = !!noGatilho;
          }
          if (podeAtivar) {
            await processarMensagemChatbot(telefoneLimpo, mensagem, dados.instance || fluxoChatbotNovo.instancia || 'STK', nomeCliente || undefined);
            return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "chatbot_started" });
          }
        }
      } catch (err: any) {
        console.error('[Chatbot] Erro (novo):', err.message);
      }
    }
    // ===== FIM INTEGRAÇÃO CHATBOT (novo atendimento) =====

    // ===== INTEGRAÇÃO IA (novo atendimento) =====
    if (!dados.fromMe && mensagem) {
      const iaAtivada = await verificarIAAtivada(getSupabase());
      if (iaAtivada) {
        try {
          const respostaIA = await gerarRespostaIA({
            mensagemCliente: mensagem,
            nomeCliente: nomeCliente || undefined,
          });

          if (respostaIA) {
            const resultado = await enviarMensagemWhatsApp({
              telefone: telefoneLimpo,
              mensagem: respostaIA,
              instance: dados.instance || undefined,
            });

            if (resultado.success) {
              console.log(`[Webhook WhatsApp] IA respondeu (novo atendimento) para ${telefoneLimpo}`);
              await getSupabase().from('atendimento_mensagens').insert({
                atendimento_id: novoAtendimento.id,
                remetente: 'vendedor',
                conteudo: respostaIA,
                enviada_por: null,
                whatsapp_message_id: resultado.message_id,
              });
            }
          }
        } catch (err: any) {
          console.error('[Webhook WhatsApp] Erro IA (novo atendimento):', err.message);
        }
      }
    }
    // ===== FIM INTEGRAÇÃO IA =====

    return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "created" });

  } catch (error: any) {
    console.error("[Webhook WhatsApp] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Extrai dados do payload da Evolution API
 * Formato padrão: { event, instance, data: { key, message, pushName, ... } }
 */
function extrairDadosEvolutionAPI(payload: any): {
  telefone: string | null;
  mensagem: string | null;
  nome: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  remoteJid: string | null;
  fromMe: boolean;
  messageId: string | null;
  instance: string | null;
  rawBase64: string | null;
  rawMime: string | null;
} {
  // Formato Evolution API: { event: 'messages.upsert', data: { key, message, pushName } }
  if (payload.event && payload.data) {
    const data = payload.data;
    const message = data.message || {};
    const key = data.key || {};

    // Extrair texto da mensagem
    let mensagem = null;
    if (message.conversation) {
      mensagem = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      mensagem = message.extendedTextMessage.text;
    } else if (message.buttonsResponseMessage?.selectedButtonId) {
      mensagem = message.buttonsResponseMessage.selectedButtonId;
    } else if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
      mensagem = message.listResponseMessage.singleSelectReply.selectedRowId;
    }

    // Extrair mídia
    // Extrair mídia
    let mediaType = null;
    let mediaUrl = null;
    let fileName = null;
    let rawBase64: string | null = null;
    let rawMime: string | null = null;

    // Extrair base64 (campo "message.base64" adicionado pela Evolution API com webhookBase64)
    const base64Data = message.base64 || null;

    if (message.imageMessage) {
      mediaType = "image";
      rawMime = message.imageMessage.mimetype || "image/jpeg";
      if (base64Data) { rawBase64 = base64Data; } else { mediaUrl = message.imageMessage.url || null; }
    } else if (message.audioMessage) {
      mediaType = "audio";
      rawMime = message.audioMessage.mimetype || "audio/ogg; codecs=opus";
      if (base64Data) { rawBase64 = base64Data; } else { mediaUrl = message.audioMessage.url || null; }
    } else if (message.videoMessage) {
      mediaType = "video";
      rawMime = message.videoMessage.mimetype || "video/mp4";
      if (base64Data) { rawBase64 = base64Data; } else { mediaUrl = message.videoMessage.url || null; }
    } else if (message.documentMessage) {
      mediaType = "document";
      rawMime = message.documentMessage.mimetype || "application/octet-stream";
      if (base64Data) { rawBase64 = base64Data; } else { mediaUrl = message.documentMessage.url || null; }
      fileName = message.documentMessage.fileName || null;
    } else if (message.stickerMessage) {
      mediaType = "sticker";
      rawMime = message.stickerMessage.mimetype || "image/webp";
      if (base64Data) { rawBase64 = base64Data; } else { mediaUrl = message.stickerMessage.url || null; }
    }

    // Extrair telefone (remove @s.whatsapp.net)
    // Suporta dois formatos da Evolution API:
    // 1. Formato antigo: data.key.remoteJid = "5562...@s.whatsapp.net"
    // 2. Formato novo (v2.3.7+): data.remoteJid = "xxx@lid" + data.sender = "5562...@s.whatsapp.net"
    let telefone: string | null = null;
    
    // Tentar extrair de key.remoteJid (formato antigo)
    const jidFromKey = key.remoteJid || "";
    // Tentar extrair de data.remoteJid (formato novo)
    const jidFromData = data.remoteJid || "";
    
    // Usar o JID que tiver valor, priorizando key
    const jid = jidFromKey || jidFromData;
    
    if (jid.endsWith("@lid") && key.remoteJidAlt) {
      // LID mode com remoteJidAlt (formato antigo com addressingMode)
      telefone = key.remoteJidAlt.replace("@s.whatsapp.net", "") || null;
    } else if (jid.endsWith("@lid") && payload.sender) {
      // LID mode sem remoteJidAlt (v2.3.7): usar campo sender do payload
      telefone = payload.sender.replace("@s.whatsapp.net", "") || null;
    } else if (jid) {
      // Normal mode: extrair do remoteJid
      telefone = jid.replace("@s.whatsapp.net", "") || null;
    }

    return {
      telefone,
      mensagem,
      nome: data.pushName || null,
      mediaType,
      mediaUrl,
      fileName,
      remoteJid: key.remoteJid || data.remoteJid || null,
      fromMe: !!(key.fromMe ?? data.fromMe),
      messageId: key.id || data.keyId || data.messageId || null,
      instance: payload.instance || null,
      rawBase64,
      rawMime,
    };
    }

    // Fallback: tenta extrair de outros formatos
    return {
    telefone: payload.phone || payload.telefone || payload.number || null,
    mensagem: payload.message || payload.mensagem || payload.text || null,
    nome: payload.name || payload.nome || payload.pushName || null,
    mediaType: payload.media_type || null,
    mediaUrl: payload.media_url || null,
    fileName: payload.file_name || null,
    remoteJid: null,
    fromMe: false,
    messageId: payload.messageId || payload.id || null,
    instance: payload.instance || null,
    rawBase64: null,
    rawMime: null,
    };
}

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
 * Cada instância WhatsApp mantém atendimentos separados
 */
async function buscarAtendimentoAberto(telefoneLimpo: string, instancia: string | null) {
  // Primeiro: busca exata por telefone + instância (rápida)
  const query = getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, instancia")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto");

  // Se tem instância, filtra por ela
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
// Force rebuild Tue Sep  8 21:44:39 -03 2026
