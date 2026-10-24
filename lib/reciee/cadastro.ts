/**
 * "Cadastrar com fatura" — cria o cliente RECIEE a partir do que a conta
 * diz, sem obrigar a preencher formulário.
 *
 * Regra comercial (João): cadastro simples, o mínimo que a fatura prova.
 * O que a fatura NÃO diz fica em branco e vira `avisos` — o motor não
 * inventa dado de cadastro, e o operador completa depois na ficha.
 */
import type { ResumoFatura } from "@/lib/ia/analisar-fatura";

export interface ClienteParaCadastrar {
  nome: string;
  cpf_cnpj: string;
  uc: string;
  estado: string;
  distribuidora: string;
  subgrupo: string;
  modalidade: string;
  classe: string;
  tensao: string;
  grupo: "A" | "B";
  gd: boolean;
}

export interface ResultadoCadastro {
  payload: ClienteParaCadastrar;
  avisos: string[];
}

/**
 * Monta o payload de `clientes_reciee` a partir da IA lendo a fatura.
 *
 * @param resumo      extração da fatura (IA)
 * @param nomeInformado  nome digitado pelo operador (usado quando a fatura
 *                       não traz o titular legível)
 */
export function montarClienteDeFatura(p: {
  resumo: ResumoFatura;
  nomeInformado?: string | null;
}): ResultadoCadastro {
  const avisos: string[] = [];
  const r = p.resumo;

  const nome = (p.nomeInformado || r.titular || "").trim();
  if (!nome) {
    avisos.push("A fatura não traz titular legível — informe o nome do cliente na ficha.");
  }

  const grupo: "A" | "B" = r.grupo === "A" ? "A" : "B";
  if (!r.grupo) {
    avisos.push("Grupo não identificado na fatura — assumido grupo B; confirme na ficha.");
  }

  const distribuidora = (r.concessionaria || "").trim();
  if (!distribuidora) {
    avisos.push("Concessionária não identificada na fatura — preencher na ficha.");
  }

  const uc = (r.uc || "").trim();
  if (!uc) avisos.push("UC não identificada na fatura — preencher na ficha.");

  const cpfCnpj = (r.cnpj_cpf || "").trim();
  if (!cpfCnpj) avisos.push("CPF/CNPJ não consta na fatura — preencher na ficha.");

  // Unidade geradora detectada = tem geração distribuída
  const gd = Boolean(
    (r.uc_geradora && r.uc_geradora.trim()) ||
      (r.energia_injetada != null && r.energia_injetada > 0)
  );

  const payload: ClienteParaCadastrar = {
    nome: nome || "(sem nome)",
    cpf_cnpj: cpfCnpj,
    uc,
    // A fatura não traz UF de forma confiável; quem define é a ficha.
    estado: "",
    distribuidora,
    subgrupo: "",
    modalidade: "",
    classe: "",
    tensao: "",
    grupo,
    gd,
  };

  return { payload, avisos };
}

/** Campo por campo que ainda falta preencher depois do cadastro automático. */
export function camposEmBranco(payload: ClienteParaCadastrar): string[] {
  const rotulos: [string, string][] = [
    ["nome", payload.nome],
    ["cpf_cnpj", payload.cpf_cnpj],
    ["uc", payload.uc],
    ["estado", payload.estado],
    ["distribuidora", payload.distribuidora],
    ["subgrupo", payload.subgrupo],
    ["modalidade", payload.modalidade],
    ["classe", payload.classe],
    ["tensao", payload.tensao],
  ];
  return rotulos.filter(([, v]) => !v || v === "(sem nome)").map(([k]) => k);
}
