/**
 * Fase 6 / C4 — API do documento de proposta.
 *
 * POST  /api/propostas              → gera o PDF, salva no Storage e grava o
 *                                     registro (upsert por oportunidade)
 * GET   /api/propostas?oportunidade_id= → lista o que já foi gerado
 *
 * Supabase fakeado em memória (inclusive o Storage) — sem rede.
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
import { GET, POST } from "./route";

// proposta criada no setup do describe de download
let propostaTeste: any = null;
import { GET as baixarArquivo } from "./[id]/arquivo/route";

function requisicaoArquivo(id: string) {
  return new NextRequest(`http://localhost/api/propostas/${id}/arquivo`);
}

function requisicao(method: string, body?: any, query = "") {
  return new NextRequest(`http://localhost/api/propostas${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
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
  email: "joao@email.com",
  endereco: "Rua das Flores",
  numero: "10",
  bairro: "Setor Central",
  cep: "74000000",
  cidade: "Goiânia",
  estado: "GO",
  concessionaria: "CEMIG",
  instalacao: "99887766",
  classe_tarifaria: "Residencial",
  subgrupo_tarifario: "B1",
  vencimento_fatura: 10,
  consumo_jan: 300,
  consumo_fev: 330,
};

beforeEach(() => {
  cenario.limpar();
  cenario.tabelas.profiles.push(
    { id: "ven-1", cargo: "vendedor" },
    { id: "ven-2", cargo: "vendedor" },
    { id: "ger-1", cargo: "gerente_comercial" }
  );
  cenario.tabelas.clientes.push({ ...CLIENTE_COMPLETO });
  cenario.tabelas.oportunidades.push({
    id: "opp-1",
    cliente_id: "cli-1",
    vendedor_id: "ven-1",
    titulo: "GD — João da Silva",
    etapa: "contrato_enviado",
    uc: "99887766",
    consumo_kwh: 400,
    valor_proposta: 1500,
    valor_venda: 1700,
  });
});

describe("POST /api/propostas — gerar documento", () => {
  it("recusa sem sessão (401)", async () => {
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(401);
    expect(cenario.estado.uploads).toHaveLength(0);
    expect(cenario.tabelas.propostas).toHaveLength(0);
  });

  it("recusa oportunidade inexistente (404)", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(requisicao("POST", { oportunidade_id: "sumiu" }));
    expect(res.status).toBe(404);
  });

  it("recusa oportunidade de outro vendedor quando não é gestor (403)", async () => {
    logar("ven-2", "vendedor");
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(403);
    expect(cenario.tabelas.propostas).toHaveLength(0);
  });

  it("aceita gestor de outro vendedor", async () => {
    logar("ger-1", "gerente_comercial");
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(201);
  });

  it("devolve 400 com a lista do que falta e não grava nada", async () => {
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
    });
    cenario.tabelas.oportunidades.push({
      id: "opp-2",
      cliente_id: "cli-2",
      vendedor_id: "ven-1",
      titulo: "GD — Maria",
      valor_proposta: null,
      valor_venda: null,
    });

    const res = await POST(requisicao("POST", { oportunidade_id: "opp-2" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.erros.join(" | ")).toMatch(/CPF\/CNPJ/);
    expect(body.erros.join(" | ")).toMatch(/valor/i);
    expect(cenario.tabelas.propostas).toHaveLength(0);
    expect(cenario.estado.uploads).toHaveLength(0);
  });

  it("gera o PDF, salva no Storage e grava o registro da proposta", async () => {
    logar("ven-1", "vendedor");
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.proposta.numero).toMatch(/^PROP-\d{8}-[0-9A-Z]{4}$/);
    expect(body.proposta.cliente_id).toBe("cli-1");
    expect(body.proposta.oportunidade_id).toBe("opp-1");
    expect(body.proposta.vendedor_id).toBe("ven-1");
    expect(body.proposta.gerado_por).toBe("ven-1");
    // caminho estável: regerar sobrescreve o mesmo objeto
    expect(body.proposta.arquivo_path).toBe("cli-1/opp-1.pdf");
    expect(body.proposta.arquivo_nome).toBe(`${body.proposta.numero}.pdf`);
    expect(body.proposta.tamanho_bytes).toBeGreaterThan(1000);
    expect(body.proposta.validade).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // snapshot do conteúdo: é ele que permite reemitir sem as fontes mudarem
    expect(body.proposta.dados.contratante.nome).toBe("João da Silva");
    expect(body.proposta.dados.comercial.valor_proposta).toBe(1500);
    expect(body.proposta.dados.uc.consumo_medio_kwh).toBe(315);

    // o arquivo está no Storage
    expect(cenario.estado.uploads).toEqual(["propostas/cli-1/opp-1.pdf"]);
    const arquivo = cenario.estado.arquivos.get("cli-1/opp-1.pdf");
    expect(arquivo).toBeDefined();
    expect(Buffer.from(arquivo!).subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // registro persistido
    expect(cenario.tabelas.propostas).toHaveLength(1);
  });

  it("gerar de novo substitui o registro da mesma oportunidade (sem duplicar)", async () => {
    logar("ven-1", "vendedor");
    const primeira = await (await POST(requisicao("POST", { oportunidade_id: "opp-1" }))).json();
    const segunda = await (await POST(requisicao("POST", { oportunidade_id: "opp-1" }))).json();

    expect(cenario.tabelas.propostas).toHaveLength(1);
    expect(segunda.proposta.id).toBe(primeira.proposta.id);
    expect(segunda.proposta.numero).toBe(primeira.proposta.numero);
  });

  it("usa o payload da fila AXS (C3) como fonte dos dados do contratante", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.fila_propostas_axs.push({
      id: "f1",
      cliente_id: "cli-1",
      oportunidade_id: "opp-1",
      created_at: "2026-09-20T00:00:00.000Z",
      payload: {
        nome: "Maria Souza ME",
        cpf_cnpj: "11222333000181",
        logradouro: "Av. Independência",
        numero: "500",
        bairro: "Jardim",
        cep: "74100000",
        cidade: "Aparecida de Goiânia",
        estado: "GO",
        uc_instalacao: "55667788",
        concessionaria: "COPEL",
        consumo_meses: { "1": "1000", "2": "1000" },
        observacoes: "Instalação em telhado.",
      },
    });

    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(201);
    const { proposta } = await res.json();
    expect(proposta.dados.contratante.nome).toBe("Maria Souza ME");
    expect(proposta.dados.uc.instalacao).toBe("55667788");
    expect(proposta.dados.uc.concessionaria).toBe("COPEL");
    expect(proposta.dados.uc.consumo_medio_kwh).toBe(1000);
    // valores continuam sendo os da oportunidade
    expect(proposta.dados.comercial.valor_proposta).toBe(1500);
  });

  it("sem oportunidade_id responde 400", async () => {
    logar("ven-1", "vendedor");
    expect((await POST(requisicao("POST", {}))).status).toBe(400);
    expect((await POST(requisicao("POST"))).status).toBe(400);
  });

  it("quando a tabela propostas não existe, avisa que falta a migration (500)", async () => {
    logar("ven-1", "vendedor");
    cenario.estado.tabelaQuebrada = "propostas";
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/093/);
  });

  it("quando o bucket não pode ser criado, avisa que falta a migration (500)", async () => {
    logar("ven-1", "vendedor");
    cenario.estado.buckets.clear();
    cenario.estado.bucketIndisponivel = true;
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/bucket/i);
    expect(body.error).toMatch(/093/);
  });
});

describe("GET /api/propostas — listar", () => {
  beforeEach(() => {
    cenario.tabelas.propostas.push(
      {
        id: "p1",
        numero: "PROP-20260927-AAAA",
        cliente_id: "cli-1",
        oportunidade_id: "opp-1",
        vendedor_id: "ven-1",
        arquivo_path: "cli-1/PROP-20260927-AAAA.pdf",
        created_at: "2026-09-27T12:00:00.000Z",
      },
      {
        id: "p2",
        numero: "PROP-20260920-BBBB",
        cliente_id: "cli-9",
        oportunidade_id: "opp-9",
        vendedor_id: "ven-2",
        arquivo_path: "cli-9/PROP-20260920-BBBB.pdf",
        created_at: "2026-09-20T12:00:00.000Z",
      }
    );
    cenario.tabelas.oportunidades.push({
      id: "opp-9",
      cliente_id: "cli-9",
      vendedor_id: "ven-2",
      titulo: "Outra",
    });
  });

  it("recusa sem sessão (401)", async () => {
    expect((await GET(requisicao("GET", undefined, "?oportunidade_id=opp-1"))).status).toBe(401);
  });

  it("o dono vê a proposta da própria oportunidade", async () => {
    logar("ven-1", "vendedor");
    const res = await GET(requisicao("GET", undefined, "?oportunidade_id=opp-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.propostas.map((p: any) => p.id)).toEqual(["p1"]);
  });

  it("vendedor alheio não vê (403) e gestor vê", async () => {
    logar("ven-2", "vendedor");
    expect((await GET(requisicao("GET", undefined, "?oportunidade_id=opp-1"))).status).toBe(403);

    logar("ger-1", "gerente_comercial");
    const res = await GET(requisicao("GET", undefined, "?oportunidade_id=opp-1"));
    expect(res.status).toBe(200);
    expect((await res.json()).propostas).toHaveLength(1);
  });

  it("sem oportunidade_id responde 400", async () => {
    logar("ven-1", "vendedor");
    expect((await GET(requisicao("GET"))).status).toBe(400);
  });
});

describe("GET /api/propostas/[id]/arquivo — baixar o PDF salvo", () => {
  beforeEach(async () => {
    logar("ven-1", "vendedor");
    const res = await POST(requisicao("POST", { oportunidade_id: "opp-1" }));
    const { proposta } = await res.json();
    propostaTeste = proposta;
  });

  it("recusa sem sessão (401)", async () => {
    cenario.estado.usuario = null;
    const res = await baixarArquivo(
      requisicaoArquivo(propostaTeste.id),
      { params: { id: propostaTeste.id } }
    );
    expect(res.status).toBe(401);
  });

  it("devolve o PDF com Content-Disposition de anexo", async () => {
    const proposta = propostaTeste;
    const res = await baixarArquivo(requisicaoArquivo(proposta.id), {
      params: { id: proposta.id },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="${proposta.arquivo_nome}"`
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("registro inexistente devolve 404", async () => {
    const res = await baixarArquivo(requisicaoArquivo("nao-existe"), {
      params: { id: "nao-existe" },
    });
    expect(res.status).toBe(404);
  });

  it("vendedor alheio não baixa a proposta de outro (403)", async () => {
    logar("ven-2", "vendedor");
    const res = await baixarArquivo(requisicaoArquivo(propostaTeste.id), {
      params: { id: propostaTeste.id },
    });
    expect(res.status).toBe(403);
  });

  it("registro sem arquivo no Storage devolve 404 com aviso", async () => {
    cenario.estado.arquivos.clear();
    const res = await baixarArquivo(requisicaoArquivo(propostaTeste.id), {
      params: { id: propostaTeste.id },
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/arquivo/i);
  });
});
