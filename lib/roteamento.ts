/**
 * Helper de roteamento de atendimentos WhatsApp
 * 
 * Quando chega mensagem de um número novo (sem vendedor no cadastro),
 * busca o vendedor padrão configurado na tabela config_roteamento_whatsapp.
 * 
 * Para rodízio futuro: adicionar lógica de round-robin aqui.
 */

import { createClient } from "@supabase/supabase-js";

let configCache: { vendedorId: string | null; expiry: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Busca o vendedor padrão para roteamento de atendimentos.
 * Usa cache de 5 minutos para evitar queries desnecessárias.
 * 
 * @returns UUID do vendedor padrão, ou null se não houver configuração
 */
const VENDEDOR_PADRAO_HARDCODED = "da38fd55-bad4-42e8-8616-844530ad052c";

export async function buscarVendedorPadrao(): Promise<string | null> {
  // Verifica cache
  if (configCache && Date.now() < configCache.expiry) {
    console.log(`[Roteamento] Usando cache: ${configCache.vendedorId}`);
    return configCache.vendedorId;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`[Roteamento] URL: ${url ? "OK" : "MISSING"}, KEY: ${key ? "OK" : "MISSING"}`);
    
    if (!url || !key) {
      console.warn("[Roteamento] Variáveis de ambiente não configuradas, usando hardcoded");
      return VENDEDOR_PADRAO_HARDCODED;
    }

    const supabase = createClient(url, key);
    console.log("[Roteamento] Consultando config_roteamento_whatsapp...");

    const { data, error } = await supabase
      .from("config_roteamento_whatsapp")
      .select("vendedor_padrao_id")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (error) {
      console.error("[Roteamento] Erro na query:", JSON.stringify(error));
      console.warn("[Roteamento] Usando fallback hardcoded:", VENDEDOR_PADRAO_HARDCODED);
      return VENDEDOR_PADRAO_HARDCODED;
    }

    if (!data) {
      console.warn("[Roteamento] Nenhum registro encontrado, usando hardcoded:", VENDEDOR_PADRAO_HARDCODED);
      return VENDEDOR_PADRAO_HARDCODED;
    }

    const vendedorId = data.vendedor_padrao_id;
    configCache = { vendedorId, expiry: Date.now() + CACHE_TTL };
    
    console.log(`[Roteamento] ✅ Vendedor padrão encontrado: ${vendedorId}`);
    return vendedorId;
  } catch (err: any) {
    console.error("[Roteamento] Erro catch:", err.message, err.stack);
    console.warn("[Roteamento] Usando fallback hardcoded:", VENDEDOR_PADRAO_HARDCODED);
    return VENDEDOR_PADRAO_HARDCODED;
  }
}

/**
 * Limpa o cache de roteamento (útil após alterações na config)
 */
export function limparCacheRoteamento(): void {
  configCache = null;
}