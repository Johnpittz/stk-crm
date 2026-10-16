/**
 * ITEM 8 — disparo em massa: ESCOLHER leads (em vez de só planilha).
 * Aqui a lógica pura: marcar leads → contatos da massa, com mesclagem
 * sem duplicar telefone (o que já está na planilha não some).
 */
import { describe, it, expect } from "vitest";
import { contatosParaMassa, mesclarContatos } from "./selecionar-leads";

const leads = [
  { id: "1", nome: "Ana", telefone: "62999998888" },
  { id: "2", nome: "Bruno", telefone: "6236311824" },
  { id: "3", nome: "SemTelefone", telefone: "" },
  { id: "4", nome: "Duplicado", telefone: "62999998888" },
];

describe("contatosParaMassa", () => {
  it("converte só os leads selecionados em contatos válidos", () => {
    const contatos = contatosParaMassa(leads, ["2"]);
    expect(contatos).toEqual([{ nome: "Bruno", telefone: "6236311824" }]);
  });

  it("ignora telefone vazio e deduplica seleção repetida", () => {
    const contatos = contatosParaMassa(leads, ["1", "3", "4"]);
    expect(contatos).toHaveLength(1);
    expect(contatos[0].telefone).toBe("62999998888");
  });
});

describe("mesclarContatos", () => {
  it("acrescenta novos sem repetir o que já existe", () => {
    const atuais = [{ nome: "Ana", telefone: "62999998888" }];
    const novos = [
      { nome: "Ana", telefone: "62999998888" },
      { nome: "Bruno", telefone: "6236311824" },
    ];
    const final = mesclarContatos(atuais, novos);
    expect(final).toHaveLength(2);
    expect(final[1].nome).toBe("Bruno");
  });

  it("mantém a ordem do que já estava", () => {
    const atuais = [
      { nome: "A", telefone: "62999991111" },
      { nome: "B", telefone: "62999992222" },
    ];
    const final = mesclarContatos(atuais, [{ nome: "C", telefone: "62999993333" }]);
    expect(final.map(c => c.telefone)).toEqual([
      "62999991111",
      "62999992222",
      "62999993333",
    ]);
  });
});
