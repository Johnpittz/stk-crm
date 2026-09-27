/**
 * Fase 3 / C3 — rota da fila de propostas AXS (docs/plano-acao-modulos.md).
 *
 * Cobre: enqueue com validação, bloqueio de duplicidade, permissão
 * vendedor×gestor, retry, marcação manual e o retroalimentação do funil.
 * Supabase fakeado em memória — sem rede.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const cenario = vi.hoisted(() => {
  type Registro = Record<string, any>;

  const tabelas: Record<string, Registro[]> = {
    profiles: [],
    clientes: [],
    oportunidades: [],
    oportunidade_historico: [],
    fila_propostas_axs: [],
  };

  const estado = { usuario: null as Registro | null, seq: 0 };

  function builder(tabela: string) {
    const est: any = {
      filtros: [] as Array<{ tipo: string; campo: string; valor: any }>,
      ordem: null as null | { campo: string; asc: boolean },
      limite: null as number | null,
      mutacao: null as null | { tipo: string; payload: Registro },
    };

    const executar = async (): Promise<Registro[]> => {
      // insert não passa por filtro
      if (est.mutacao?.tipo === "insert") {
        const novo: Registro = {
          id: `id-${++estado.seq}`,
          created_at: "2026-09-27T00:00:00.000Z",
          updated_at: "2026-09-27T00:00:00.000Z",
          ...est.mutacao.payload,
        };
        (tabelas[tabela] ??= []).push(novo);
        return [novo];
      }

      let linhas = [...(tabelas[tabela] ?? [])];
      for (const f of est.filtros) {
        linhas = linhas.filter((l) =>
          f.tipo === "eq" ? l[f.campo] === f.valor : (f.valor as any[]).includes(l[f.campo])
        );
      }
      if (est.ordem) {
        const { campo, asc } = est.ordem;
        linhas.sort(
          (a, b) =>
            (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (asc ? 1 : -1)
        );
      }
      if (est.limite != null) linhas = linhas.slice(0, est.limite);

      // PostgREST devolve SNAPSHOT (JSON), não as linhas vivas da tabela —
      // sem cópia, um update faria o objeto já lido "viajar no tempo".
      if (est.mutacao?.tipo === "update") {
        linhas.forEach((l) => Object.assign(l, est.mutacao.payload));
        return linhas.map((l) => ({ ...l }));
      }
      return linhas.map((l) => ({ ...l }));
    };

    const b: any = {};
    b.select = () => b;
    b.insert = (payload: Registro) => {
      est.mutacao = { tipo: "insert", payload };
      return b;
    };
    b.update = (payload: Registro) => {
      est.mutacao = { tipo: "update", payload };
      return b;
    };
    b.eq = (campo: string, valor: any) => {
      est.filtros.push({ tipo: "eq", campo, valor });
      return b;
    };
    b.in = (campo: string, valor: any[]) => {
      est.filtros.push({ tipo: "in", campo, valor });
      return b;
    };
    b.order = (campo: string, opts?: { ascending?: boolean }) => {
      est.ordem = { campo, asc: opts?.ascending !== false };
      return b;
    };
    b.limit = (n: number) => {
      est.limite = n;
      return b;
    };
    b.then = (res: any, rej: any) =>
      executar().then((linhas) => res({ data: linhas, error: null }), rej);
    b.maybeSingle = () =>
      executar().then((linhas) => ({ data: linhas[0] ?? null, error: null }));
    b.single = () =>
      executar().then((linhas) =>
        linhas.length
          ? { data: linhas[0], error: null }
          : { data: null, error: { message: "0 rows" } }
      );
    return b;
  }

  const limpar = () => {
    for (const k of Object.keys(tabelas)) tabelas[k] = [];
    estado.usuario = null;
    estado.seq = 0;
  };

  return { tabelas, estado, builder, limpar };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: cenario.estado.usuario },
        error: cenario.estado.usuario ? null : { message: "no session" },
      }),
    },
    from: (tabela: string) => cenario.builder(tabela),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (tabela: string) => cenario.builder(tabela) }),
}));

import { GET, POST, PATCH } from "./route";

const PAYLOAD_VALIDO = {
  tipo_imovel: "casa",
  tipo_pessoa: "pf",
  cpf_cnpj: "12345678900",
  nome: "João da Silva",
  cep: "74000000",
  cidade: "Goiânia",
  estado: "GO",
  classe: "Residencial",
  telefone: "(62) 3333-4444",
  uc_instalacao: "123456",
};

function requisicao(method: string, body?: any, query = "") {
  return new NextRequest(`http://localhost/api/axs/fila${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function logar(id: string, cargo: string) {
  cenario.estado.usuario = { id, email: `${id}@x.com`, cargo };
}

function semSessao() {
  cenario.estado.usuario = null;
}

const CLIENTE = { id: "cli-1", nome_completo: "João da Silva" };

beforeEach(() => {
  cenario.limpar();
  cenario.tabelas.clientes.push({ ...CLIENTE });
  cenario.tabelas.profiles.push({ id: "ven-1", cargo: "vendedor", email: "ven1@x.com" });
  cenario.tabelas.profiles.push({ id: "ger-1", cargo: "gerente_comercial", email: "ger1@x.com" });
  cenario.tabelas.profiles.push({ id: "ven-2", cargo: "vendedor", email: "ven2@x.com" });
});

describe("POST /api/axs/fila — enfileirar", () => {
  it("recusa sem sessão (401)", async () => {
    semSessao();
    const res = await POST(requisicao("POST", { cliente_id: "cli-1", dados_proposta: PAYLOAD_VALIDO }));
    expect(res.status).toBe(401);
  });

  it("recusa payload incompleto com a lista de erros (400)", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(
      requisicao("POST", { cliente_id: "cli-1", dados_proposta: { nome: "", cep: "" } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.erros.length).toBeGreaterThan(0);
    expect(cenario.tabelas.fila_propostas_axs).toHaveLength(0);
  });

  it("recusa cliente inexistente (404)", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(
      requisicao("POST", { cliente_id: "nao-existe", dados_proposta: PAYLOAD_VALIDO })
    );
    expect(res.status).toBe(404);
  });

  it("grava como pendente, atribui ao vendedor e vincula a oportunidade aberta", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.oportunidades.push({
      id: "opp-9",
      cliente_id: "cli-1",
      vendedor_id: "ven-1",
      etapa: "recebeu_conta",
      updated_at: "2026-09-01T00:00:00.000Z",
    });

    const res = await POST(
      requisicao("POST", { cliente_id: "cli-1", dados_proposta: PAYLOAD_VALIDO })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.status).toBe("pendente");
    expect(body.item.vendedor_id).toBe("ven-1");
    expect(body.item.oportunidade_id).toBe("opp-9");
    expect(body.item.tentativas).toBe(0);
    expect(body.item.payload.cpf_cnpj).toBe("12345678900");
    expect(body.item.origem).toBe("crm");
  });

  it("409 quando o cliente já tem item pendente na fila", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.fila_propostas_axs.push({
      id: "fila-1",
      cliente_id: "cli-1",
      status: "pendente",
      vendedor_id: "ven-1",
    });

    const res = await POST(
      requisicao("POST", { cliente_id: "cli-1", dados_proposta: PAYLOAD_VALIDO })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("já tem uma proposta");
    expect(body.id).toBe("fila-1");
  });

  it("aceita novo item quando o anterior terminou em erro", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.fila_propostas_axs.push({
      id: "fila-1",
      cliente_id: "cli-1",
      status: "erro",
      vendedor_id: "ven-1",
    });

    const res = await POST(
      requisicao("POST", { cliente_id: "cli-1", dados_proposta: PAYLOAD_VALIDO })
    );
    expect(res.status).toBe(201);
    expect(cenario.tabelas.fila_propostas_axs).toHaveLength(2);
  });
});

describe("GET /api/axs/fila — listar", () => {
  beforeEach(() => {
    cenario.tabelas.fila_propostas_axs.push(
      { id: "f1", status: "erro", vendedor_id: "ven-1", cliente_id: "cli-1", created_at: "2026-09-26T00:00:00.000Z" },
      { id: "f2", status: "criada", vendedor_id: "ven-2", cliente_id: "cli-2", created_at: "2026-09-25T00:00:00.000Z" }
    );
  });

  it("vendedor vê só os próprios itens", async () => {
    logar("ven-1", "vendedor");
    const res = await GET(requisicao("GET"));
    const body = await res.json();
    expect(body.gestor).toBe(false);
    expect(body.itens.map((i: any) => i.id)).toEqual(["f1"]);
  });

  it("gestor vê a fila inteira", async () => {
    logar("ger-1", "gerente_comercial");
    const res = await GET(requisicao("GET"));
    const body = await res.json();
    expect(body.gestor).toBe(true);
    expect(body.itens).toHaveLength(2);
  });

  it("filtra por status", async () => {
    logar("ger-1", "gerente_comercial");
    const res = await GET(requisicao("GET", undefined, "?status=erro"));
    const body = await res.json();
    expect(body.itens.map((i: any) => i.id)).toEqual(["f1"]);
  });

  it("recusa sem sessão (401)", async () => {
    semSessao();
    const res = await GET(requisicao("GET"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/axs/fila — retry", () => {
  function itemErro(extra: any = {}) {
    cenario.tabelas.fila_propostas_axs.push({
      id: "f1",
      status: "erro",
      tentativas: 6,
      erro: "VPS respondeu 502",
      job_id: "job-7",
      cliente_id: "cli-1",
      oportunidade_id: null,
      vendedor_id: "ven-1",
      ...extra,
    });
  }

  it("dono pode reenfileirar: zera tentativas e volta para pendente", async () => {
    logar("ven-1", "vendedor");
    itemErro();
    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "retry" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("pendente");
    expect(body.item.tentativas).toBe(0);
    expect(body.item.erro).toBeNull();
    expect(body.item.job_id).toBe("job-7"); // mantém o job: evita duplicar na AXS
  });

  it("item de outro vendedor não pode ser reenfileirado (403)", async () => {
    logar("ven-2", "vendedor");
    itemErro();
    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "retry" }));
    expect(res.status).toBe(403);
  });

  it("gestor pode reenfileirar item de terceiros", async () => {
    logar("ger-1", "gerente_comercial");
    itemErro();
    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "retry" }));
    expect(res.status).toBe(200);
    expect((await res.json()).item.status).toBe("pendente");
  });

  it("não reenvia item já criado (409 — seria proposta duplicada)", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.fila_propostas_axs.push({
      id: "f1",
      status: "criada",
      vendedor_id: "ven-1",
      cliente_id: "cli-1",
      oportunidade_id: null,
    });
    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "retry" }));
    expect(res.status).toBe(409);
  });

  it("item inexistente devolve 404 e ação desconhecida 400", async () => {
    logar("ven-1", "vendedor");
    expect((await PATCH(requisicao("PATCH", { id: "sumiu", acao: "retry" }))).status).toBe(404);
    expect((await PATCH(requisicao("PATCH", { id: "f1", acao: "deletar" }))).status).toBe(400);
  });
});

describe("PATCH /api/axs/fila — manual + retroalimentação do funil", () => {
  function semearItem(etapa: string) {
    cenario.tabelas.oportunidades.push({
      id: "opp-1",
      cliente_id: "cli-1",
      vendedor_id: "ven-1",
      etapa,
      updated_at: "2026-09-01T00:00:00.000Z",
    });
    cenario.tabelas.fila_propostas_axs.push({
      id: "f1",
      status: "erro",
      tentativas: 6,
      erro: "sem AXS",
      cliente_id: "cli-1",
      oportunidade_id: "opp-1",
      vendedor_id: "ven-1",
    });
  }

  it("marca como manual e leva a oportunidade para proposta_feita", async () => {
    logar("ven-1", "vendedor");
    semearItem("recebeu_conta");

    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "manual" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("manual");
    expect(body.item.origem).toBe("manual");
    expect(body.funil_avancado).toBe(true);
    expect(cenario.tabelas.oportunidades[0].etapa).toBe("proposta_feita");
    expect(cenario.tabelas.oportunidade_historico).toHaveLength(1);
    expect(cenario.tabelas.oportunidade_historico[0]).toMatchObject({
      oportunidade_id: "opp-1",
      etapa_anterior: "recebeu_conta",
      etapa_nova: "proposta_feita",
      created_by: "ven-1",
    });
  });

  it("nunca regreda uma oportunidade que já passou da proposta", async () => {
    logar("ven-1", "vendedor");
    semearItem("contrato_enviado");

    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "manual" }));
    const body = await res.json();
    expect(body.item.status).toBe("manual");
    expect(body.funil_avancado).toBe(false);
    expect(cenario.tabelas.oportunidades[0].etapa).toBe("contrato_enviado");
    expect(cenario.tabelas.oportunidade_historico).toHaveLength(0);
  });

  it("não marca item já criado como manual (409)", async () => {
    logar("ven-1", "vendedor");
    semearItem("recebeu_conta");
    cenario.tabelas.fila_propostas_axs[0].status = "criada";
    const res = await PATCH(requisicao("PATCH", { id: "f1", acao: "manual" }));
    expect(res.status).toBe(409);
  });
});
