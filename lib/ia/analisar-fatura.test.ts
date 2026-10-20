/**
 * PARTE 11 (PPTX 17/10) — "Análise da conta": a IA lê a foto/PDF da
 * fatura e extrai concessionária, UC, titular, CNPJ, vencimento,
 * consumo e valor. Puro e testado (provedor mockado).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../ia-provider", () => ({
  chamarModelo: vi.fn(async () => ""),
  chamarModeloVision: vi.fn(async () => ""),
}));

import { montarPromptFatura, analisarFatura, analisarFaturaTexto, parseRespostaFatura } from "./analisar-fatura";
import { chamarModeloVision, chamarModelo } from "../ia-provider";

describe("FASE A - campos novos da extração (regras comerciais)", () => {
  it("prompt cobra grupo, contratação livre, CNAE, ponta e UCs", () => {
    const p = montarPromptFatura();
    expect(p).toContain("grupo");
    expect(p).toMatch(/livre/i);
    expect(p).toContain("CNAE");
    expect(p).toMatch(/ponta/i);
    expect(p).toMatch(/geradora/i);
    expect(p).toContain("JSON");
  });

  // 19/10 — protocolo "lógica dos produtos": a conta REAL traz "B3",
  // "B2 — Rural", "A5"... Aceitar só "A"/"B" exatos jogava o grupo pra
  // null e TODA a tela de oportunidades de Grupo B virava "preliminar".
  it("paraGrupo aceita o grupo como a conta escreve (B3, A5, B2 - Rural)", async () => {
    const { paraGrupo } = await import("./analisar-fatura");
    expect(paraGrupo("B3")).toBe("B");
    expect(paraGrupo("B2 — Rural")).toBe("B");
    expect(paraGrupo("A5")).toBe("A");
    expect(paraGrupo("Grupo B3")).toBe("B");
    expect(paraGrupo("b3 comercial")).toBe("B");
    expect(paraGrupo("A")).toBe("A");
    expect(paraGrupo(null)).toBe(null);
    expect(paraGrupo("")).toBe(null);
  });

  // 19/10 — números da conta em português: "5.495,48" (milhar+decimal),
  // "4.548" (só milhar), "1.174665" (preço unitário). Number() cru dava
  // NaN ou engolia o ponto de milhar — é o que deixou valor/consumo
  // errados na tela e matou a média do RECIEE.
  it("numeroBR entende o formato da conta brasileira", async () => {
    const { numeroBR } = await import("./analisar-fatura");
    expect(numeroBR("5.495,48")).toBe(5495.48);
    expect(numeroBR("4.548,00")).toBe(4548);
    expect(numeroBR("4.548")).toBe(4548);
    expect(numeroBR("10.994,80")).toBe(10994.8);
    expect(numeroBR("5495.48")).toBe(5495.48);
    expect(numeroBR("1.174665")).toBe(1.174665);
    expect(numeroBR("R$ 5.571,22")).toBe(5571.22);
    expect(numeroBR(null)).toBe(null);
    expect(numeroBR("")).toBe(null);
  });

  it("parse lê grupo B3 e números com vírgula como a conta real traz", () => {
    const r = parseRespostaFatura(
      JSON.stringify({
        concessionaria: "Equatorial Goiás",
        uc: "196314801274",
        titular: "HOTEL RIO DOS BOIS",
        consumo: "4.548,00",
        valor: "5.571,22",
        grupo: "B3 — Comercial",
        consumo_ponta: "4.100,50",
        energia_injetada: "1.234,5",
      })
    );
    expect(r.grupo).toBe("B");
    expect(r.consumo_ponta).toBe(4100.5);
    expect(r.energia_injetada).toBe(1234.5);
  });

  it("parse reconhece grupo A/B, contratação livre, ponta e UCs", async () => {
    const { chamarModeloVision } = await import("../ia-provider");
    (chamarModeloVision as any).mockResolvedValue(
      JSON.stringify({
        concessionaria: "CEMIG",
        uc: "270977101881",
        titular: "Joao",
        cnpj_cpf: "000.000.000-00",
        vencimento_dia: "18",
        consumo_kwh: "1760",
        valor_total: "293,70",
        grupo: "B",
        contratacao_livre: false,
        cnae_principal: "5513-0/01 - Hoteis",
        consumo_ponta: "4100",
        energia_injetada: "1760",
        uc_geradora: "999",
        uc_consumidora: "270977101881",
      })
    );
    const r = await analisarFatura({ mimeTipo: "image/png", base64: "x" });
    expect(r.grupo).toBe("B");
    expect(r.contratacao_livre).toBe(false);
    expect(r.cnae_principal).toContain("5513");
    expect(r.consumo_ponta).toBe(4100);
    expect(r.energia_injetada).toBe(1760);
    expect(r.uc_geradora).toBe("999");
    expect(r.uc_consumidora).toBe("270977101881");
  });
});

describe("montarPromptFatura", () => {
  it("pede JSON com todos os campos", () => {
    const p = montarPromptFatura();
    for (const campo of ["concessionaria", "uc", "titular", "cnpj_cpf", "vencimento", "consumo", "valor"]) {
      expect(p).toContain(campo);
    }
    expect(p).toContain("JSON");
  });
});

describe("analisarFatura", () => {
  it("extrai os campos da resposta da IA", async () => {
    vi.mocked(chamarModeloVision).mockResolvedValue(
      '{"concessionaria":"Celonor","uc":"123456","titular":"FOOD BRASA","cnpj_cpf":"11.222.333/0001-44","vencimento":"10","consumo":"342","valor":"1234.56"}'
    );
    const r = await analisarFatura({ mimeTipo: "image/jpeg", base64: "abc" });
    expect(r.concessionaria).toBe("Celonor");
    expect(r.uc).toBe("123456");
    expect(r.titular).toBe("FOOD BRASA");
    expect(r.cnpj_cpf).toContain("11.222");
    expect(r.vencimento).toBe("10");
    expect(r.consumo).toBe("342");
    expect(r.valor).toBe("1234.56");
  });

  it("aceita resposta embrulhada em ```json", async () => {
    vi.mocked(chamarModeloVision).mockResolvedValue(
      'Claro! Aqui está:\n```json\n{"concessionaria":"Equatorial","uc":"9","titular":null,"cnpj_cpf":null,"vencimento":"5","consumo":"100","valor":"89.9"}\n```'
    );
    const r = await analisarFatura({ mimeTipo: "image/png", base64: "xyz" });
    expect(r.concessionaria).toBe("Equatorial");
    expect(r.valor).toBe("89.9");
  });

  it("caminho de TEXTO (PDF extraído) também extrai os campos", async () => {
    vi.mocked(chamarModelo).mockResolvedValue(
      '{"concessionaria":"Celnor","uc":"777","titular":"LOJA X","cnpj_cpf":null,"vencimento":"20","consumo":"55","valor":"321.10"}'
    );
    const r = await analisarFaturaTexto("Fatura Celnor UC 777 ...");
    expect(r.concessionaria).toBe("Celnor");
    expect(r.uc).toBe("777");
    expect(r.valor).toBe("321.10");
  });

  it("resposta sem JSON devolve campos null (nunca lança)", async () => {
    vi.mocked(chamarModeloVision).mockResolvedValue("não consegui ler a imagem");
    const r = await analisarFatura({ mimeTipo: "image/jpeg", base64: "abc" });
    expect(r.concessionaria).toBeNull();
    expect(r.uc).toBeNull();
    expect(r.valor).toBeNull();
  });
});
