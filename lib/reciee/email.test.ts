/**
 * Email da concessionária — a entrega combinada com o João:
 * o relatório sai COM o texto pronto do email.
 */
import { describe, expect, it } from "vitest";
import { montarEmailConcessionaria } from "./email";
import type { Achado, FaturaReciee } from "./tipos";

const cliente = {
  nome: "SANDOVAL GARCIA DA SILVEIRA JR",
  uc: "000266515901272",
  cpf_cnpj: "12.345.678/0001-90",
  cidade: "PIRENOPOLIS",
  estado: "GO",
  distribuidora: "Equatorial Goiás Distribuidora de Energia",
};

function fatura(): FaturaReciee {
  return {
    referencia: "ABR/2026",
    estado: "GO",
    inicio: "2026-03-25",
    fim: "2026-04-24",
    dias: 30,
    consumo: 4670,
    leituraAnterior: 74051,
    leituraAtual: 78721,
    fatorK: 1,
    linhas: [
      {
        descricao: "CONSUMO / FATURÁVEL",
        quantidade: 4670,
        tarifaCct: 1.125925,
        tarifaSemTributos: 0.89181,
        valor: 5258.07,
      },
    ],
    impostos: {
      baseIcms: 5258.07,
      aliquotaIcms: 19,
      icms: 999.03,
      basePisCofins: 4259.04,
      aliquotaPis: 0.3918,
      pis: 16.69,
      aliquotaCofins: 1.822,
      cofins: 77.6,
    },
    bandeiraCobradaSemTributos: 0,
    itens: [
      { descricao: "CONTRIB. ILUM. PÚBLICA - MUNICIPAL", valor: 80 },
      { descricao: "JURO DE FINANCIAMENTO - 20691/2026 - 3/7", valor: 82.42 },
      { descricao: "MULTA(S) ATRASO PGTO NEGOCIAÇÃO - 20691/2026 - 3/7", valor: 26.1 },
    ],
    valorTotal: 6812.13,
  };
}

const achados: Achado[] = [
  {
    codigo: "RECIEE-058",
    tema: "Tarifação",
    descricao: "Tarifa sem tributos de R$ 0,745930 contra a homologada de R$ 0,891810.",
    severidade: "critico",
    valorEstimado: 716.02,
    referencia: "ABR/2026",
  },
  {
    codigo: "MOTOR-FURO",
    tema: "Medição e leitura",
    descricao: "JUN/2024 termina em 2024-06-24 e AGO/2024 começa em 2024-07-24: falta JUL/2024.",
    severidade: "alerta",
    valorEstimado: 0,
    referencia: "AGO/2024",
  },
];

describe("email da concessionária", () => {
  it("identifica cliente, UC, distribuidora e período das faturas", () => {
    const { assunto, corpo } = montarEmailConcessionaria({
      cliente,
      faturas: [fatura()],
      achados,
    });
    expect(assunto).toContain("000266515901272");
    expect(assunto).toContain("SANDOVAL");
    expect(corpo).toContain("EQUATORIAL GOIÁS");
    expect(corpo).toContain("ABR/2026 a ABR/2026");
    expect(corpo).toContain("1 fatura(s), total de R$ 6.812,13");
    expect(corpo).toContain("PIRENOPOLIS/GO");
    expect(corpo).toContain("12.345.678/0001-90");
  });

  it("só traz as seções que têm achado, com o valor em disputa", () => {
    const { corpo } = montarEmailConcessionaria({
      cliente,
      faturas: [fatura()],
      achados,
    });
    // seção de tarifa e seção de medição entram (há achado nelas)
    expect(corpo).toContain("4. TARIFA APLICADA x TARIFA HOMOLOGADA");
    expect(corpo).toContain("6. MEDIÇÃO, LEITURAS E FATURAS NÃO LOCALIZADAS");
    expect(corpo).toContain("R$ 716,02 em disputa");
    expect(corpo).toContain("falta JUL/2024");
    // sem achado de bandeira/tributos, essas seções ficam de fora
    expect(corpo).not.toContain("7. BANDEIRA TARIFÁRIA");
    expect(corpo).not.toContain("5. TRIBUTOS");
  });

  it("lista os itens financeiros questionados agrupados por tipo", () => {
    const { corpo } = montarEmailConcessionaria({
      cliente,
      faturas: [fatura()],
      achados: [],
    });
    expect(corpo).toContain("ITENS FINANCEIROS QUESTIONADOS");
    expect(corpo).toContain("CONTRIB. ILUM. PÚBLICA - MUNICIPAL: R$ 80,00 em 1 fatura(s)");
    expect(corpo).toContain("JURO DE FINANCIAMENTO: R$ 82,42 em 1 fatura(s)");
    expect(corpo).toContain("MULTA(S) ATRASO PGTO NEGOCIAÇÃO: R$ 26,10 em 1 fatura(s)");
  });

  it("cobre os pedidos padrão: documentos, prazo de 15 dias e o Procon/ANEEL", () => {
    const { corpo } = montarEmailConcessionaria({
      cliente,
      faturas: [fatura()],
      achados: [],
    });
    expect(corpo).toContain("DOCUMENTOS QUE SOLICITO");
    expect(corpo).toContain("art. 22 do Código de Defesa do Consumidor");
    expect(corpo).toContain("até 15 dias");
    expect(corpo).toContain("Procon");
    expect(corpo).toContain("ANЕEL".replace("Е", "E"));
    expect(corpo).toContain("Atenciosamente,");
  });
});
