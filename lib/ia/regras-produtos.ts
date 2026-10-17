/**
 * FASE A ("lógica dos produtos para o CRM", 17/10) — motor de regras
 * comerciais. Puro: os dados lidos da conta viram oportunidades com
 * status, motivo, evidência e pendência. Regras são INDEPENDENTES —
 * uma conta pode acionar vários produtos ao mesmo tempo; faltar dado
 * vira pendência (preliminar/inconclusiva), nunca descarte silencioso.
 */
export type StatusOportunidade =
  | "identificada"
  | "preliminar"
  | "nao_acionada"
  | "inconclusiva";

export type Produto =
  | "mercado_livre"
  | "gd_assinatura"
  | "gd_grupo_a"
  | "usina_proprietaria"
  | "bess"
  | "reciee"
  | "eletroposto"
  | "sigma_solar";

export interface DadosConta {
  /** Classe tarifária lida na conta (A = ponta/grupo alto, B = horo-sazonal) */
  grupo: "A" | "B" | null;
  /** Unidade já está no ambiente de contratação livre? null = não lido */
  contratacao_livre: boolean | null;
  /** Média financeira mensal da UC em R$ (não a fatura de um mês) */
  valor_medio_mensal: number | null;
  /** Consumo NO HORÁRIO DE PONTA (kWh) — único que vale pro BESS */
  consumo_ponta: number | null;
  consumo_total: number | null;
  /** CNAE principal do CNPJ (eletroposto: restaurante/hotel/academia/shopping/supermercado) */
  cnae_principal: string | null;
  /** kWh injetados/compensados pela usina */
  energia_injetada: number | null;
  uc_geradora: string | null;
  uc_consumidora: string | null;
}

export interface OportunidadeProduto {
  produto: Produto;
  status: StatusOportunidade;
  motivo: string;
  evidencia?: string;
  pendencia?: string;
}

const CNPAE_ELETROPOSTO = ["restaur", "hotel", "hoteis", "academia", "shopping", "supermerc"];

const norm = (v: string | null | undefined) =>
  String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** UC: só dígitos na comparação (contas trazem "2.709.771.018-81") */
const normUc = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

const numero = (v: number | null | undefined) => (v == null ? null : Number(v));

/**
 * FASE A — média financeira mensal da UC (gatilho do RECIEE).
 * Protocolo: uma fatura não é a média; com menos de 3 faturas a
 * apuração fica pendente (a rota envia null → status preliminar).
 */
export function calcularMediaFinanceira(
  valores: Array<number | null | undefined>,
): number | null {
  const validos = valores.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (validos.length < 3) return null;
  const soma = validos.reduce((a, b) => a + b, 0);
  return Math.round((soma / validos.length) * 100) / 100;
}

export function aplicarRegras(dados: DadosConta): OportunidadeProduto[] {
  const out: OportunidadeProduto[] = [];

  // ── Mercado Livre: só pro mercado REGULADO; se já está no livre, não vender migração
  if (dados.contratacao_livre === true) {
    out.push({
      produto: "mercado_livre",
      status: "nao_acionada",
      motivo: "Unidade já está no ambiente de contratação livre — não recomendar migração.",
      evidencia: "Conta com 'Demanda Livre' (contratação livre).",
    });
  } else if (dados.contratacao_livre === false && dados.grupo) {
    out.push({
      produto: "mercado_livre",
      status: "identificada",
      motivo: "Unidade no mercado regulado — elegível para Mercado Livre.",
      evidencia: `Grupo ${dados.grupo} em mercado regulado (sem contratação livre).`,
    });
  } else {
    out.push({
      produto: "mercado_livre",
      status: "preliminar",
      motivo: "Ambiente de contratação não identificado na conta.",
      pendencia: "Confirmar se a unidade está no mercado regulado ou livre.",
    });
  }

  // ── GD por assinatura: público é Grupo B (com economia REAL, nunca prometida)
  if (dados.grupo === "B") {
    out.push({
      produto: "gd_assinatura",
      status: "identificada",
      motivo: "Grupo B elegível para Energia por Assinatura (GD).",
      pendencia: "Simular a economia real antes de apresentar qualquer desconto.",
    });
  } else if (dados.grupo === "A") {
    out.push({
      produto: "gd_assinatura",
      status: "nao_acionada",
      motivo: "Grupo A — caminho é contratação/usina própria, não assinatura.",
    });
  } else {
    out.push({
      produto: "gd_assinatura",
      status: "preliminar",
      motivo: "Grupo tarifário não identificado.",
      pendencia: "Ler a classe tarifária na conta.",
    });
  }

  // ── GD Grupo A: nunca automático — depende do ambiente/contratação existente
  if (dados.grupo === "A") {
    out.push({
      produto: "gd_grupo_a",
      status: "preliminar",
      motivo: "Grupo A exige análise de compatibilidade antes de ofertar GD.",
      pendencia:
        dados.contratacao_livre === true
          ? "Unidade já no livre: verificar compatibilidade com a contratação existente."
          : "Verificar ambiente de contratação e viabilidade de gerador próprio.",
    });
  } else if (dados.grupo === "B") {
    out.push({
      produto: "gd_grupo_a",
      status: "nao_acionada",
      motivo: "Grupo B — via assinatura (GD-B), não pelo caminho de Grupo A.",
    });
  }

  // ── Usina solar própria: fatura sozinha nunca prova — sempre a avaliar
  if (dados.uc_geradora && dados.uc_consumidora) {
    const mesma = normUc(dados.uc_geradora) === normUc(dados.uc_consumidora);
    out.push(
      mesma
        ? {
            produto: "usina_proprietaria",
            status: "identificada",
            motivo: "UC geradora igual à consumidora — indício forte de usina própria.",
            evidencia: `UC geradora ${dados.uc_geradora} = UC consumidora.`,
          }
        : {
            produto: "usina_proprietaria",
            status: "preliminar",
            motivo: "UCs diferentes: a geração é de terceiro — avaliar o que cabe ao cliente.",
            pendencia: "Confirmar titularidade da usina.",
          }
    );
  } else {
    out.push({
      produto: "usina_proprietaria",
      status: "preliminar",
      motivo: "Usina própria sempre depende de estudo de viabilidade.",
      pendencia: "Solicitar estudo (a conta não prova viabilidade por si só).",
    });
  }

  // ── BESS: só consumo NA PONTA > 4.000 kWh (total nunca aciona)
  const ponta = numero(dados.consumo_ponta);
  if (ponta != null && ponta > 4000) {
    out.push({
      produto: "bess",
      status: "identificada",
      motivo: "Consumo no horário de ponta acima do limite de 4.000 kWh.",
      evidencia: `Ponta ${ponta} kWh > 4.000 kWh.`,
    });
  } else {
    out.push({
      produto: "bess",
      status: "nao_acionada",
      motivo:
        ponta != null
          ? `Consumo na ponta (${ponta} kWh) não passa de 4.000 kWh — total não vale como critério.`
          : "Sem dado de consumo na ponta — o total do mês não aciona o BESS.",
      pendencia:
        ponta != null ? undefined : "Se houver ponta relevante, apurar o dado de ponta.",
    });
  }

  // ── RECIEE: média financeira mensal > R$ 5.000 (não uma fatura isolada)
  const media = numero(dados.valor_medio_mensal);
  if (media != null && media > 5000) {
    out.push({
      produto: "reciee",
      status: "identificada",
      motivo: "Média financeira mensal acima de R$ 5.000.",
      evidencia: `Média mensal R$ ${media.toFixed(2)} > R$ 5.000,00.`,
    });
  } else if (media != null) {
    out.push({
      produto: "reciee",
      status: "nao_acionada",
      motivo: "Média financeira mensal não passa de R$ 5.000.",
      evidencia: `Média mensal R$ ${media.toFixed(2)}.`,
    });
  } else {
    out.push({
      produto: "reciee",
      status: "preliminar",
      motivo: "Uma fatura não é a média — precisa apurar o valor mensal.",
      pendencia: "Apurar a média financeira mensal da UC (mínimo 12 meses).",
    });
  }

  // ── Eletroposto: CNAE principal do CNPJ (razão social não vale)
  const cnae = norm(dados.cnae_principal);
  if (!cnae) {
    out.push({
      produto: "eletroposto",
      status: "preliminar",
      motivo: "CNPJ sem CNAE identificado na conta.",
      pendencia: "Consultar o CNAE principal do CNPJ (cnpj.biz/serpro).",
    });
  } else if (CNPAE_ELETROPOSTO.some((c) => cnae.includes(c))) {
    out.push({
      produto: "eletroposto",
      status: "identificada",
      motivo: "CNAE principal compatível com eletroposto.",
      evidencia: `CNAE: ${dados.cnae_principal}.`,
    });
  } else {
    out.push({
      produto: "eletroposto",
      status: "nao_acionada",
      motivo: "CNAE principal fora da lista (restaurante, hotel, academia, shopping, supermercado).",
      evidencia: `CNAE: ${dados.cnae_principal}.`,
    });
  }

  // ── Sigma Solar: exige evidência de usina PRÓPRIA (geradora = consumidora)
  const injetada = numero(dados.energia_injetada);
  if (injetada != null && injetada > 0) {
    if (dados.uc_geradora && dados.uc_consumidora) {
      const mesma = normUc(dados.uc_geradora) === normUc(dados.uc_consumidora);
      out.push(
        mesma
          ? {
              produto: "sigma_solar",
              status: "identificada",
              motivo: "Energia injetada por usina da própria UC — elegível ao monitoramento.",
              evidencia: `${injetada} kWh injetados; UC geradora ${dados.uc_geradora} = consumidora.`,
            }
          : {
              produto: "sigma_solar",
              status: "nao_acionada",
              motivo: "Energia vem de usina de terceiro — não conta como usina própria.",
              evidencia: `Geradora ${dados.uc_geradora} ≠ consumidora ${dados.uc_consumidora}.`,
            }
      );
    } else {
      out.push({
        produto: "sigma_solar",
        status: "inconclusiva",
        motivo: "Conta injeta energia, mas não se sabe de quem é a usina.",
        pendencia: "Investigar o proprietário da usina geradora.",
      });
    }
  } else {
    out.push({
      produto: "sigma_solar",
      status: "nao_acionada",
      motivo: "Sem energia injetada/compensada na conta.",
    });
  }

  return out;
}
