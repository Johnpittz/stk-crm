/**
 * ITEM 8 — extração de leads a partir do texto de PDF/Word/planilha.
 * Regra: cada telefone BR válido vira um lead; o nome é o texto antes do
 * telefone na mesma linha (ou a última linha com nome acima dele).
 */

export interface LeadExtraido {
  nome: string;
  telefone: string;
}

/** Telefone em qualquer formato comum BR: com/sem 55, com/sem parênteses. */
const REGEX_TELEFONE =
  /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}(?!\d)/g;

/** `normalizarTelefoneBr("(62) 99999-8888")` → "62999998888" (só nacional). */
export function normalizarTelefoneBr(bruto: string): string | null {
  const digitos = (bruto || "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return null;
  let nacional = digitos;
  if (nacional.startsWith("55") && nacional.length >= 12) {
    nacional = nacional.slice(2);
  }
  if (nacional.length < 10 || nacional.length > 11) return null;
  return nacional;
}

function limparNome(bruto: string): string {
  return bruto
    .replace(/^[\s\d.,;:()\-–—•|/"']+/, "")
    .replace(/[\s.,;:()\-–—•|/"']+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function extrairLeads(texto: string): LeadExtraido[] {
  const linhas = (texto || "").split(/\r?\n/);
  const vistos = new Set<string>();
  const leads: LeadExtraido[] = [];
  let ultimoNome = "";

  for (const linha of linhas) {
    const limpa = linha.trim();
    if (!limpa) continue;

    const regex = new RegExp(REGEX_TELEFONE.source, "g");
    const match = regex.exec(limpa);
    if (!match) {
      const candidato = limparNome(limpa);
      if (candidato && !/^[\d\s()+\-.]+$/.test(candidato)) {
        ultimoNome = candidato;
      }
      continue;
    }

    const telefone = normalizarTelefoneBr(match[0]);
    if (!telefone || vistos.has(telefone)) continue;
    vistos.add(telefone);

    const antes = limpa.slice(0, match.index);
    const nome = limparNome(antes) || ultimoNome;
    leads.push({ nome, telefone });
    if (nome) ultimoNome = nome;
  }

  return leads;
}
