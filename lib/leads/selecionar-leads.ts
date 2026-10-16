/**
 * ITEM 8 — escolher leads no disparo em massa: lógica pura de
 * seleção (marcados → contatos) e mesclagem com a planilha.
 */

export interface ContatoMassa {
  nome: string;
  telefone: string;
}

export interface LeadParaSelecao {
  id?: string;
  nome: string;
  telefone: string;
}

/** Leads marcados → contatos da massa (telefone normalizado, sem repetir). */
export function contatosParaMassa(
  leads: LeadParaSelecao[],
  idsSelecionados: Array<string | number>
): ContatoMassa[] {
  const alvo = new Set(idsSelecionados.map(String));
  const vistos = new Set<string>();
  const contatos: ContatoMassa[] = [];

  for (const lead of leads) {
    if (!alvo.has(String(lead.id ?? ""))) continue;
    const telefone = (lead.telefone || "").replace(/\D/g, "");
    if (telefone.length < 10 || vistos.has(telefone)) continue;
    vistos.add(telefone);
    contatos.push({ nome: lead.nome || "", telefone });
  }
  return contatos;
}

/** Junta os leads escolhidos ao que já veio da planilha, sem duplicar. */
export function mesclarContatos(
  atuais: ContatoMassa[],
  novos: ContatoMassa[]
): ContatoMassa[] {
  const vistos = new Set(
    atuais.map(c => c.telefone.replace(/\D/g, "")).filter(Boolean)
  );
  const resultado = [...atuais];
  for (const contato of novos) {
    const telefone = contato.telefone.replace(/\D/g, "");
    if (!telefone || vistos.has(telefone)) continue;
    vistos.add(telefone);
    resultado.push({ ...contato, telefone });
  }
  return resultado;
}
