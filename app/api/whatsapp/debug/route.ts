/**
 * Rota temporária de DEBUG - mostra estado das env vars e testa a conexão
 * Endpoint: GET /api/whatsapp/debug
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const evoUrl = process.env.EVOLUTION_API_URL || "NOT_SET";
  const evoKey = process.env.EVOLUTION_API_KEY || "NOT_SET";
  const evoInstance = process.env.EVOLUTION_INSTANCE || "NOT_SET";

  const debug: any = {
    // Mostrar apenas comprimento e se parece válido (não expor valores reais)
    EVOLUTION_API_URL: {
      set: evoUrl !== "NOT_SET",
      length: evoUrl.length,
      looksLikeUrl: evoUrl.startsWith("http"),
      host: (() => { try { return new URL(evoUrl).hostname; } catch { return "INVALID_URL"; } })(),
      port: (() => { try { return new URL(evoUrl).port; } catch { return "N/A"; } })(),
    },
    EVOLUTION_API_KEY: {
      set: evoKey !== "NOT_SET",
      length: evoKey.length,
    },
    EVOLUTION_INSTANCE: {
      set: evoInstance !== "NOT_SET",
      value: evoInstance !== "NOT_SET" ? evoInstance : "NOT_SET",
    },
  };

  // Testar conexão com a Evolution API
  try {
    const testUrl = `${evoUrl}/instance/fetchInstances`;
    debug.testUrl = testUrl;
    
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: evoKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    debug.testStatus = response.status;
    const body = await response.text();
    debug.testBodyPreview = body.substring(0, 200);

    if (response.ok) {
      const data = JSON.parse(body);
      debug.instancesFound = Array.isArray(data) ? data.length : "not_array";
      debug.instancesNames = Array.isArray(data) 
        ? data.map((i: any) => i.name || i.id || "?")
        : [];
    }
  } catch (err: any) {
    debug.testError = err.message;
  }

  return NextResponse.json(debug, { status: 200 });
}
