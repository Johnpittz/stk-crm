/**
 * 06/10 — LOG DE CRIAÇÃO/EDIÇÃO de clientes (recurso novo; leitura só
 * admin — ver /api/clientes/log).
 *
 * `registrarAuditoria` é BEST-EFFORT por design: falha na trilha de
 * auditoria NUNCA pode derravar o save do cliente. Gravação nas rotas
 * POST/PUT de /api/clientes.
 */

export interface UsuarioAuditoria {
  id: string;
  email: string;
}

interface ClienteAcessivel {
  from(tabela: string): any;
}

export interface RegistroAuditoria {
  clienteId: string;
  clienteNome: string | null;
  acao: "criado" | "editado";
  campos: string[];
  usuario: UsuarioAuditoria | null;
}

/** Campos do payload cujo valor difere da linha anterior (para o log). */
export function camposAlterados(
  antes: Record<string, any> | null | undefined,
  depois: Record<string, any>
): string[] {
  const mudados: string[] = [];
  for (const [chave, valor] of Object.entries(depois)) {
    const anterior = antes ? antes[chave] : undefined;
    if (JSON.stringify(anterior ?? null) !== JSON.stringify(valor ?? null)) {
      mudados.push(chave);
    }
  }
  return mudados;
}

export async function registrarAuditoria(
  admin: ClienteAcessivel,
  registro: RegistroAuditoria
): Promise<void> {
  try {
    const { error } = await admin.from("cliente_auditoria").insert({
      cliente_id: registro.clienteId,
      cliente_nome: registro.clienteNome ?? null,
      acao: registro.acao,
      campos: registro.campos ?? [],
      usuario_id: registro.usuario?.id ?? null,
      usuario_email: registro.usuario?.email ?? null,
    });
    if (error) {
      console.error("[Auditoria] falha ao registrar:", error.message ?? error);
    }
  } catch (e: any) {
    console.error("[Auditoria] falha ao registrar:", e?.message ?? e);
  }
}
