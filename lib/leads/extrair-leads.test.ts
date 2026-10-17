/**
 * ITEM 8 — MARKETING/LEADS (16/10): importar lista (PDF, Word etc) e
 * escolher leads no disparo em massa.
 * Aqui: a extração PURA de leads a partir do texto do arquivo
 * (phone BR em qualquer formato comum) + mesclagem na massa.
 */
import { describe, it, expect } from "vitest";
import { extrairLeads, normalizarTelefoneBr } from "./extrair-leads";

describe("normalizarTelefoneBr", () => {
  it("remove formatação e prefixo 55", () => {
    expect(normalizarTelefoneBr("(62) 99999-8888")).toBe("62999998888");
    expect(normalizarTelefoneBr("62 99999-8888")).toBe("62999998888");
    expect(normalizarTelefoneBr("+55 62 99999-8888")).toBe("62999998888");
    expect(normalizarTelefoneBr("5562999998888")).toBe("62999998888");
    expect(normalizarTelefoneBr("62 3631-1824")).toBe("6236311824");
  });

  it("devolve null para lixo", () => {
    expect(normalizarTelefoneBr("abc")).toBeNull();
    expect(normalizarTelefoneBr("12345")).toBeNull(); // curto demais
    expect(normalizarTelefoneBr("")).toBeNull();
  });
});

describe("extrairLeads", () => {
  it("extrai nome e telefone de linhas simples", () => {
    const texto = [
      "João Silva - 62 99999-8888",
      "Maria Souza, (62) 98888-7777",
      "Empresa Bom Preço: +55 (62) 97777-6666",
    ].join("\n");
    const leads = extrairLeads(texto);
    expect(leads).toHaveLength(3);
    expect(leads[0]).toEqual({ nome: "João Silva", telefone: "62999998888" });
    expect(leads[1].nome).toBe("Maria Souza");
    expect(leads[1].telefone).toBe("62988887777");
    expect(leads[2].telefone).toBe("62977776666");
  });

  it("aceita telefone numérico corrido (55 + DDD + número)", () => {
    const leads = extrairLeads("Pedro\n5562991112222");
    expect(leads).toHaveLength(1);
    expect(leads[0].telefone).toBe("62991112222");
  });

  it("pega TODOS os telefones de uma mesma linha (PDF achapado vira uma linha só)", () => {
    const texto = "Loja A 62 91111-1111 Loja B (62) 92222-2222 Loja C +55 62 93333-3333";
    const leads = extrairLeads(texto);
    expect(leads.map(l => l.telefone)).toEqual([
      "62911111111",
      "62922222222",
      "62933333333",
    ]);
    expect(leads[0].nome).toBe("Loja A");
    expect(leads[1].nome).toBe("Loja B");
    expect(leads[2].nome).toBe("Loja C");
  });

  it("ignora linhas sem telefone", () => {
    expect(extrairLeads("Só texto\nNada de número aqui")).toHaveLength(0);
  });

  it("não pega CEP curto (8 dígitos)", () => {
    expect(extrairLeads("CEP 74000-000")).toHaveLength(0);
  });

  it("deduplica telefone repetido", () => {
    const leads = extrairLeads("Ana - 62 99999-8888\nAna - 62 99999-8888");
    expect(leads).toHaveLength(1);
  });

  it("pega o nome da linha anterior quando o telefone vem sozinho", () => {
    const leads = extrairLeads("Carlos Andrade\n62 93333-4444");
    expect(leads).toHaveLength(1);
    expect(leads[0].telefone).toBe("62933334444");
    expect(leads[0].nome).toBe("Carlos Andrade");
  });

  // ─── Planilhas pt-BR (separador ponto-e-vírgula) — usabilidade 17/10 ───
  it("CSV com ponto-e-vírgula: nome antes do telefone", () => {
    const leads = extrairLeads(
      "Nome;Telefone\nMaria Silva;62999998888\nJoão Souza;62912345678",
    );
    expect(leads).toEqual([
      { nome: "Maria Silva", telefone: "62999998888" },
      { nome: "João Souza", telefone: "62912345678" },
    ]);
  });

  it("CSV com ponto-e-vírgula: telefone PRIMEIRO e nome depois", () => {
    const leads = extrairLeads("62999998888;João Souza");
    expect(leads).toEqual([{ nome: "João Souza", telefone: "62999998888" }]);
  });
});
