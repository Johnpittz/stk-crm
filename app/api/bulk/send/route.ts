/**
 * API para enviar campanha de disparo em massa
 * 
 * POST /api/bulk/send
 * Body: { campaignId: string }
 * 
 * Envia mensagens com cadência controlada (3-8s entre envios)
 * Limite: 60/hora, 500/dia
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarMensagemWhatsApp, enviarMidiaWhatsApp } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId é obrigatório" }, { status: 400 });
    }

    // Buscar campanha
    const { data: campaign, error: fetchError } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    if (campaign.status === "running") {
      return NextResponse.json({ error: "Campanha já está em execução" }, { status: 400 });
    }

    // Atualizar status para running
    await supabase
      .from("bulk_campaigns")
      .update({ status: "running" })
      .eq("id", campaignId);

    // Enviar em background (não bloqueia a resposta)
    enviarCampanha(supabase, campaign).catch((err) => {
      console.error("[Bulk Send] Erro:", err);
    });

    return NextResponse.json({ success: true, message: "Campanha iniciada" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function enviarCampanha(supabase: any, campaign: any) {
  const rawNumbers = campaign.numbers || [];
  // Se o primeiro elemento não for numérico, é a instância
  let instanceName = "ROMA_2";
  let contacts: Array<{ nome: string; telefone: string }> = [];
  
  if (rawNumbers.length > 0 && !/^\\d/.test(String(rawNumbers[0]))) {
    instanceName = rawNumbers[0];
    // Parse contatos: podem ser strings ou objetos { nome, telefone }
    contacts = rawNumbers.slice(1).map((n: any) => {
      if (typeof n === 'object' && n.telefone) {
        return { nome: n.nome || '', telefone: n.telefone };
      }
      // Formato antigo: só número
      return { nome: '', telefone: String(n) };
    });
  } else {
    contacts = rawNumbers.map((n: any) => {
      if (typeof n === 'object' && n.telefone) {
        return { nome: n.nome || '', telefone: n.telefone };
      }
      return { nome: '', telefone: String(n) };
    });
  }

  const intervalo = (campaign.intervalo || campaign.delay_min || 5) * 1000;
  let sent = 0;
  let failed = 0;

  console.log(`[Bulk Send] Iniciando campanha "${campaign.name}" - ${contacts.length} contatos - instância: ${instanceName} - intervalo: ${intervalo/1000}s`);

  // Salvar números no gatilho do chatbot (se houver fluxo ativo)
  try {
    const { data: fluxoAtivo } = await supabase
      .from('chatbot_flows')
      .select('id')
      .eq('gatilho', 'disparo')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (fluxoAtivo) {
      const gatilhoRecords = contacts.map((c) => {
        const num = c.telefone.replace(/\\D/g, "");
        return { flow_id: fluxoAtivo.id, telefone: num.startsWith("55") ? num : "55" + num };
      });
      await supabase.from('chatbot_gatilho_numeros').upsert(gatilhoRecords, { onConflict: 'flow_id,telefone' });
      console.log(`[Bulk Send] ${gatilhoRecords.length} números salvos no gatilho do chatbot`);
    }
  } catch (err: any) {
    console.error('[Bulk Send] Erro ao salvar gatilho:', err.message);
  }

  if (contacts.length === 0) {
    console.error(`[Bulk Send] Nenhum contato encontrado! rawNumbers:`, rawNumbers);
    await supabase.from("bulk_campaigns").update({ status: "completed", failed: 0 }).eq("id", campaign.id);
    return;
  }

  const campaignStart = Date.now();
  console.log(`[Bulk Send] Tempo total início: ${new Date().toISOString()}`);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    try {
      // Formatar número (adicionar 55 se não tiver)
      let formattedNumber = contact.telefone.replace(/\\D/g, "");
      if (!formattedNumber.startsWith("55")) {
        formattedNumber = "55" + formattedNumber;
      }

      // Buscar nome do WhatsApp se não tiver na planilha
      let nomeContato = contact.nome;
      if (!nomeContato) {
        try {
          const { data: lidData } = await supabase
            .from("lid_phone_map")
            .select("push_name")
            .eq("phone", formattedNumber)
            .not("push_name", "is", null)
            .limit(1)
            .maybeSingle();
          if (lidData?.push_name) {
            nomeContato = lidData.push_name;
          }
        } catch {
          // Silencioso - continua sem nome
        }
      }

      console.log(`[Bulk Send] [${i+1}/${contacts.length}] Nome para ${formattedNumber}: "${nomeContato}" (fonte: ${contact.nome ? 'planilha' : 'WhatsApp/db'})`);

      // Substituir variáveis na mensagem
      let mensagemFinal = campaign.message;
      if (nomeContato) {
        mensagemFinal = mensagemFinal.replace(/\{\{nome\}\}/g, nomeContato);
      }
      mensagemFinal = mensagemFinal.replace(/\{\{telefone\}\}/g, formattedNumber);
      
      console.log(`[Bulk Send] [${i+1}/${contacts.length}] Mensagem final: "${mensagemFinal.substring(0, 100)}..."`);

      const msgStart = Date.now();
      console.log(`[Bulk Send] [${i+1}/${contacts.length}] Enviando para ${formattedNumber}${nomeContato ? ' (' + nomeContato + ')' : ''}...`);

      // Enviar mensagem via instância correta
      const result = await enviarMensagemWhatsApp({
        telefone: formattedNumber,
        mensagem: mensagemFinal,
        instance: instanceName,
      });

      const msgEnd = Date.now();
      console.log(`[Bulk Send] [${i+1}/${contacts.length}] ${formattedNumber} - ${result.success ? 'OK' : 'FALHA'} - API levou ${msgEnd - msgStart}ms`);

      if (result.success) {
        sent++;

        // Enviar imagem após o texto (se houver)
        if (campaign.imagem_url) {
          try {
            // Determinar mimetype da URL
            const ext = campaign.imagem_url.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              webp: 'image/webp', gif: 'image/gif',
            };
            const mimetype = mimeMap[ext] || 'image/jpeg';

            const imgResult = await enviarMidiaWhatsApp({
              telefone: formattedNumber,
              mediatype: 'image',
              mimetype,
              media: campaign.imagem_url,
              instance: instanceName,
            });

            console.log(`[Bulk Send] [${i+1}/${contacts.length}] Imagem para ${formattedNumber} - ${imgResult.success ? 'OK' : 'FALHA'}`);

            // Aguardar 2s entre texto e imagem
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (imgErr: any) {
            console.error(`[Bulk Send] Erro enviar imagem para ${formattedNumber}:`, imgErr.message);
          }
        }
      } else {
        failed++;
        console.error(`[Bulk Send] Falha para ${formattedNumber}:`, result.error);
      }

      // Atualizar contadores
      await supabase
        .from("bulk_campaigns")
        .update({ sent, failed })
        .eq("id", campaign.id);

      // Intervalo fixo entre envios (exceto no último)
      if (i < contacts.length - 1) {
        console.log(`[Bulk Send] Aguardando ${intervalo/1000}s antes do próximo...`);
        await new Promise((resolve) => setTimeout(resolve, intervalo));
      }
    } catch (err: any) {
      failed++;
      console.error(`[Bulk Send] Erro para ${contact.telefone}:`, err.message);
    }
  }

  console.log(`[Bulk Send] Campanha finalizada em ${((Date.now() - campaignStart) / 1000).toFixed(1)}s total`);

  // Finalizar campanha
  await supabase
    .from("bulk_campaigns")
    .update({ status: "completed" })
    .eq("id", campaign.id);

  console.log(`[Bulk Send] Campanha "${campaign.name}" concluída - ${sent} enviados, ${failed} falharam`);
}
