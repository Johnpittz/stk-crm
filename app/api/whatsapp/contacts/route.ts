/**
 * Rota para listar contatos do WhatsApp
 * 
 * Endpoint: GET /api/whatsapp/contacts
 * Query params: search (opcional), limit (opcional, padrão 100), instance (opcional)
 * 
 * Retorna contatos salvos na agenda e contatos de grupos
 */

import { NextRequest, NextResponse } from "next/server";
import { findContacts } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const instance = searchParams.get("instance") || undefined;

    // Limitar a 500 contatos por requisição
    if (limit > 500) {
      return NextResponse.json(
        { error: "Máximo de 500 contatos por requisição" },
        { status: 400 }
      );
    }

    console.log(`[Contacts] Buscando contatos... search="${search || ''}" limit=${limit}`);

    const result = await findContacts({ search, limit, instance });

    if (!result.success) {
      console.error("[Contacts] Erro:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log(`[Contacts] Encontrados: ${result.total} contatos`);

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      total: result.total,
    });
  } catch (error: any) {
    console.error("[Contacts] Erro geral:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar contatos" },
      { status: 500 }
    );
  }
}
