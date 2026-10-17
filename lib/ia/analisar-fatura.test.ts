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

import { montarPromptFatura, analisarFatura, analisarFaturaTexto } from "./analisar-fatura";
import { chamarModeloVision, chamarModelo } from "../ia-provider";

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
