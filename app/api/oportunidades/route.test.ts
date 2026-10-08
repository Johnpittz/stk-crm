/**
 * Fase 6 / C4 — gatilho do documento de proposta na virada de etapa.
 *
 * Decisão D8: quando a oportunidade entra em `contrato_enviado` a rota gera o
 * PDF sozinha (e devolve `proposta` na resposta). Falha de geração NUNCA
 * bloqueia a mudança de etapa — o vendedor continua podendo usar o botão.
 *
 * O restante do PATCH (permissão, histórico, comissao_paga) já existia; aqui
 * fica coberto também.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: cenario.estado.usuario },
          error: cenario.estado.usuario ? null : { message: "no session" },
        }),
      },
      from: (tabela: string) => cenario.builder(tabela),
    }),
  };
});

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createAdminClient: () => ({
      from: (tabela: string) => cenario.builder(tabela),
      storage: cenario.storage,
    }),
  };
});

import { cenario } from "@/lib/testes/supabase-fake";
import { POST, PATCH } from "./route";

function patch(body: any) {
  return new NextRequest("http://localhost/api/oportunidades", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function logar(id: string, cargo: string) {
  cenario.estado.usuario = { id, email: `${id}@x.com`, cargo };
}

const CLIENTE_COMPLETO = {
  id: "cli-1",
  nome_razao_social: "João da Silva",
  cnpj_cpf: "12345678900",
  telefone: "(62) 3333-4444",
  endereco: "Rua das Flores",
  numero: "10",
  cidade: "Goiânia",
  estado: "GO",
  concessionaria: "CEMIG",
  instalacao: "99887766",
  consumo_jan: 300,
  consumo_fev: 330,
};

beforeEach(() => {
  cenario.limpar();
  cenario.tabelas.profiles.push(
    { id: "ven-1", cargo: "vendedor" },
    { id: "ger-1", cargo: "gerente_comercial" }
  );
  cenario.tabelas.clientes.push({ ...CLIENTE_COMPLETO });
  cenario.tabelas.oportunidades.push({
    id: "opp-1",
    cliente_id: "cli-1",
    vendedor_id: "ven-1",
    titulo: "GD — João da Silva",
    etapa: "proposta_feita",
    valor_proposta: 1500,
    valor_venda: 1700,
  });
});

describe("PATCH /api/oportunidades — gatilho do documento de proposta (D8)", () => {
  it("recusa sem sessão (401) e recusa vendedor alheio (403)", async () => {
    expect(
      (await PATCH(patch({ id: "opp-1", etapa: "contrato_enviado" }))).status
    ).toBe(401);

    cenario.estado.usuario = { id: "ven-x", email: "venx@x.com", cargo: "vendedor" };
    expect(
      (await PATCH(patch({ id: "opp-1", etapa: "contrato_enviado" }))).status
    ).toBe(403);
    expect(cenario.tabelas.propostas).toHaveLength(0);
  });

  it("entrar em contrato_enviado gera a proposta e devolve na resposta", async () => {
    logar("ven-1", "vendedor");
    const res = await PATCH(patch({ id: "opp-1", etapa: "contrato_enviado" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.oportunidade.etapa).toBe("contrato_enviado");
    expect(body.proposta.numero).toMatch(/^PROP-\d{8}-[0-9A-Z]{4}$/);
    expect(body.proposta_erros).toBeNull();

    expect(cenario.tabelas.propostas).toHaveLength(1);
    expect(cenario.estado.uploads).toEqual(["propostas/cli-1/opp-1.pdf"]);
    expect(cenario.tabelas.oportunidade_historico).toHaveLength(1);
  });

  it("cadastro incompleto: muda a etapa, devolve os erros e não grava nada", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.clientes.push({
      id: "cli-2",
      nome_razao_social: "Maria",
      cidade: "Goiânia",
      estado: "GO",
      endereco: "Rua B",
      numero: "5",
      instalacao: null,
      concessionaria: null,
      cnpj_cpf: null,
    });
    cenario.tabelas.oportunidades.push({
      id: "opp-2",
      cliente_id: "cli-2",
      vendedor_id: "ven-1",
      titulo: "GD — Maria",
      etapa: "proposta_feita",
      valor_proposta: null,
      valor_venda: null,
    });

    const res = await PATCH(patch({ id: "opp-2", etapa: "contrato_enviado" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.oportunidade.etapa).toBe("contrato_enviado");
    expect(body.proposta).toBeNull();
    expect(body.proposta_erros.join(" | ")).toMatch(/CPF\/CNPJ/);
    expect(body.proposta_erros.join(" | ")).toMatch(/valor/i);

    expect(cenario.tabelas.propostas).toHaveLength(0);
    expect(cenario.estado.uploads).toHaveLength(0);
  });

  it("oportunidade sem cliente vinculado também não gera (e não bloqueia)", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.oportunidades.push({
      id: "opp-3",
      cliente_id: null,
      vendedor_id: "ven-1",
      titulo: "Sem cliente",
      etapa: "proposta_feita",
    });

    const res = await PATCH(patch({ id: "opp-3", etapa: "contrato_enviado" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposta).toBeNull();
    expect(body.proposta_erros.join(" ")).toMatch(/cliente/i);
    expect(cenario.tabelas.propostas).toHaveLength(0);
  });

  it("mudar para outra etapa não gera proposta", async () => {
    logar("ven-1", "vendedor");
    const res = await PATCH(patch({ id: "opp-1", etapa: "apresentacao_realizada" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposta).toBeNull();
    expect(body.proposta_erros).toBeNull();
    expect(cenario.tabelas.propostas).toHaveLength(0);
    expect(cenario.estado.uploads).toHaveLength(0);
  });

  it("já estar em contrato_enviado e mudar outro campo não regenera", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.oportunidades[0].etapa = "contrato_enviado";

    const res = await PATCH(patch({ id: "opp-1", valor_venda: 1900 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposta).toBeNull();
    expect(cenario.tabelas.propostas).toHaveLength(0);
  });

  it("entrar duas vezes gera uma única proposta (upsert)", async () => {
    logar("ven-1", "vendedor");
    await PATCH(patch({ id: "opp-1", etapa: "contrato_enviado" }));
    // sai e entra de novo
    await PATCH(patch({ id: "opp-1", etapa: "proposta_feita" }));
    await PATCH(patch({ id: "opp-1", etapa: "contrato_enviado" }));

    expect(cenario.tabelas.propostas).toHaveLength(1);
  });
});

// ── Fase 3 (06/10) — produto vinculado à oportunidade ─────────────────
describe("Fase 3 — produto na oportunidade (migration 095)", () => {
  beforeEach(() => {
    cenario.tabelas.produtos = [
      { id: "p1", nome: "GD", ativo: true },
      { id: "p2", nome: "RECIEE", ativo: true },
    ];
  });

  it("POST grava o produto_id da oportunidade", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(
      patch({ titulo: "GD — Novo cliente", tipo: "ligacao", prioridade: "media", produto_id: "p1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.oportunidade.produto_id).toBe("p1");
    const criada = cenario.tabelas.oportunidades.find(
      (o: any) => o.titulo === "GD — Novo cliente",
    );
    expect(criada?.produto_id).toBe("p1");
  });

  it("POST sem produto continua normal (produto_id ausente)", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(
      patch({ titulo: "Sem produto", tipo: "ligacao", prioridade: "media" }),
    );
    expect(res.status).toBe(200);
    const semProduto = cenario.tabelas.oportunidades.find(
      (o: any) => o.titulo === "Sem produto",
    );
    expect(semProduto?.produto_id).toBeNull();
  });

  it("PATCH troca o produto de quem é dono", async () => {
    logar("ven-1", "vendedor");
    const res = await PATCH(patch({ id: "opp-1", produto_id: "p2" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.oportunidade.produto_id).toBe("p2");
    expect(cenario.tabelas.oportunidades[0].produto_id).toBe("p2");
  });
});
