/**
 * PARTE 11 (PPTX 17/10) — ORIGEM do cliente no cadastro/edição:
 *   tipo (vendedor/parceiro/marketing) → subtipo → responsável.
 *   Vendedor: escolhe um vendedor CADASTRADO (vincula o cliente).
 *   Parceiro: digita o nome. Marketing: só o subtipo.
 * Puro e testado — a página só monta a UI e salva via payload.
 */

export interface OrigemCliente {
  origem_tipo?: string;
  origem_subtipo?: string;
  vendedor_responsavel_id?: string;
  origem_indicacao_nome?: string;
}

export const OPÇÕES_ORIGEM: Record<
  string,
  { rotulo: string; subtipos: string[]; sub_rotulos: Record<string, string> }
> = {
  vendedor: {
    rotulo: "Vendedor",
    subtipos: ["interno", "externo"],
    sub_rotulos: { interno: "Interno", externo: "Externo" },
  },
  parceiro: {
    rotulo: "Parceiro",
    subtipos: ["comercial", "institucional"],
    sub_rotulos: { comercial: "Comercial", institucional: "Institucional" },
  },
  marketing: {
    rotulo: "Marketing",
    subtipos: ["trafego_pago", "outras_acoes"],
    sub_rotulos: { trafego_pago: "Tráfego Pago", outras_acoes: "Outras ações" },
  },
};

/** Valida a origem; retorna a lista de erros (vazia = ok). */
export function validarOrigem(o: OrigemCliente): string[] {
  const erros: string[] = [];
  const tipo = (o.origem_tipo || "").trim();
  if (!tipo) return erros; // campo opcional

  const defs = OPÇÕES_ORIGEM[tipo];
  if (!defs) {
    erros.push("Origem inválida.");
    return erros;
  }
  const subtipo = (o.origem_subtipo || "").trim();
  if (!subtipo) {
    erros.push(`Escolha o tipo de ${defs.rotulo.toLowerCase()}.`);
  } else if (!defs.subtipos.includes(subtipo)) {
    erros.push(`Subtipo inválido para ${defs.rotulo.toLowerCase()}.`);
  }

  if (tipo === "vendedor" && !o.vendedor_responsavel_id) {
    erros.push("Escolha o vendedor que ficará com o cliente.");
  }
  if (tipo === "parceiro" && !(o.origem_indicacao_nome || "").trim()) {
    erros.push("Digite o nome do parceiro.");
  }
  return erros;
}

/** Campos prontos para o payload do cliente (coluna nova + compat). */
export function montarCamposOrigem(o: OrigemCliente): Record<string, string | null> {
  const tipo = (o.origem_tipo || "").trim() || null;
  const subtipo = (o.origem_subtipo || "").trim() || null;
  const vendedor = (o.vendedor_responsavel_id || "").trim() || null;
  const nome = (o.origem_indicacao_nome || "").trim() || null;
  return {
    origem_tipo: tipo,
    origem_subtipo: subtipo,
    vendedor_responsavel_id: vendedor,
    origem_indicacao_nome: tipo === "parceiro" ? nome : null,
    // compat: dashboard/v_unified_clientes leem origem_lead
    origem_lead: tipo,
  };
}
