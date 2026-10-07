/**
 * 06/10 — LOG DE CRIAÇÃO/EDIÇÃO de clientes (só admin vê — recurso novo).
 *
 * `camposAlterados` fixa QUÉM mudou o quê (para o log); `registrarAuditoria`
 * grava em `cliente_auditoria` SEMPRE em modo best-effort: falha de log nunca
 * pode derrubar o save do cliente (é só trilha de auditoria).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { camposAlterados, registrarAuditoria } from "./auditoria";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("camposAlterados", () => {
  it("lista só os campos cujo valor mudou (comparando com a linha anterior)", () => {
    const antes = { nome_razao_social: "Rede ABC", email: "a@x.com", cidade: "GOIÂNIA" };
    const depois = { nome_razao_social: "Rede ABC", email: "novo@x.com", cidade: "GOIÂNIA" };
    expect(camposAlterados(antes, depois)).toEqual(["email"]);
  });

  it("conta campo novo (antes undefined → depois com valor)", () => {
    expect(camposAlterados({ nome: "X" }, { nome: "X", nome_contato: "Ana" })).toEqual([
      "nome_contato",
    ]);
  });

  it("conta campo apagado (depois null)", () => {
    expect(camposAlterados({ email: "a@x.com" }, { email: null })).toEqual(["email"]);
  });

  it("sem linha anterior: todos os campos enviados contam", () => {
    expect(camposAlterados(null, { a: 1, b: "x" })).toEqual(["a", "b"]);
  });
});

describe("registrarAuditoria", () => {
  function builderComErro(error: any) {
    return () => ({
      insert: (_row: any) => ({
        then: (res: any) => Promise.resolve({ data: null, error }).then(res),
      }),
    });
  }

  it("grava a trilha com cliente, ação, campos e usuário", async () => {
    const inserts: any[] = [];
    const admin = {
      from: (_t: string) => ({
        insert: (row: any) => {
          inserts.push(row);
          return { then: (res: any) => Promise.resolve({ data: row, error: null }).then(res) };
        },
      }),
    };

    await registrarAuditoria(admin as any, {
      clienteId: "c1",
      clienteNome: "Rede ABC",
      acao: "editado",
      campos: ["email", "telefone"],
      usuario: { id: "u1", email: "joao@x.com" },
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({
      cliente_id: "c1",
      cliente_nome: "Rede ABC",
      acao: "editado",
      campos: ["email", "telefone"],
      usuario_id: "u1",
      usuario_email: "joao@x.com",
    });
  });

  it("best-effort: erro do banco NÃO lança (save do cliente não pode quebrar)", async () => {
    const admin = builderComErro({ message: "relation does not exist" });
    await expect(
      registrarAuditoria(admin as any, {
        clienteId: "c1",
        clienteNome: null,
        acao: "criado",
        campos: [],
        usuario: null,
      })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("best-effort: exceção inesperada também não propaga", async () => {
    const admin = {
      from: () => {
        throw new Error("boom");
      },
    };
    await expect(
      registrarAuditoria(admin as any, {
        clienteId: "c1",
        clienteNome: null,
        acao: "criado",
        campos: [],
        usuario: null,
      })
    ).resolves.toBeUndefined();
  });
});
