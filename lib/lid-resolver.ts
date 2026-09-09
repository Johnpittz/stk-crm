/**
 * LID Resolver para Evolution API v2.3.7+
 * 
 * A Evolution API v2.3.7+ usa "LID addressing" para mensagens diretas.
 * O remoteJid vem no formato "xxx@lid" em vez de "5562...@s.whatsapp.net".
 * 
 * Estratégia de resolução:
 * 1. Cache em memória (rápido, persiste durante a vida do container)
 * 2. Tabela lid_phone_map no Supabase (quando disponível)
 * 
 * Quando resolvemos um LID a partir de remoteJidAlt ou sender no payload,
 * salvamos o mapeamento para uso futuro.
 */

import { createClient } from "@supabase/supabase-js";

// Cache em memória (ttl de 1 hora)
const cache = new Map<string, { phone: string; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

let supabaseInstance: any = null;
function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || url.includes("[SENSITIVE]")) return null;
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch {
    return null;
  }
}

/**
 * Resolve um LID (ex: "70570624438404@lid") para um número de telefone.
 * Retorna o número sem formatação (ex: "5562999264849") ou null se não encontrar.
 */
export async function resolveLidToPhone(
  lid: string,
  instanceName: string
): Promise<string | null> {
  if (!lid || !lid.endsWith("@lid")) return null;
  
  // 1. Cache em memória
  const cached = cache.get(lid);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[LID Resolver] Cache hit: ${lid} → ${cached.phone}`);
    return cached.phone;
  }
  
  // 2. Tabela Supabase (se disponível)
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("lid_phone_map")
        .select("phone")
        .eq("lid", lid)
        .eq("instance_name", instanceName)
        .maybeSingle();
      
      if (data?.phone) {
        console.log(`[LID Resolver] DB hit: ${lid} → ${data.phone}`);
        cache.set(lid, { phone: data.phone, ts: Date.now() });
        return data.phone;
      }
    } catch (err: any) {
      // Tabela pode não existir ainda — não é erro
      if (!err.message?.includes("does not exist")) {
        console.error("[LID Resolver] Erro ao consultar Supabase:", err.message);
      }
    }
  }
  
  return null;
}

/**
 * Salva um mapeamento LID → phone no cache e no banco.
 * Chamado quando resolvemos um LID a partir do payload (remoteJidAlt, sender, etc.)
 */
export async function saveLidMapping(
  lid: string,
  phone: string,
  instanceName: string,
  pushName?: string | null
): Promise<void> {
  if (!lid || !phone) return;
  
  // Normalizar: garantir que phone não tem @s.whatsapp.net
  const phoneClean = phone.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  if (!phoneClean) return;
  
  // Salvar no cache
  cache.set(lid, { phone: phoneClean, ts: Date.now() });
  
  // Salvar no banco (upsert) — ignora erro se tabela não existir
  const supabase = getSupabase();
  if (!supabase) return;
  
  try {
    await supabase.from("lid_phone_map").upsert(
      {
        lid,
        phone: phoneClean,
        instance_name: instanceName,
        push_name: pushName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lid,instance_name" }
    );
  } catch {
    // Tabela pode não existir ainda — silencioso
  }
}
