/**
 * 05/10 — Botão REENVIAR falhas (pedido do João).
 *
 * Depois do conserto do LID, ainda sobram campanhas com falha registrada em
 * `disparo_logs` (ex.: 9c4dd883 — sent=1, failed=30). Em vez de refazer a
 * campanha do zero, a rota reenfileira SÓ os contatos que falharam, copiando
 * mensagens/imagens/instância/intervalos do original.
 *
 * Regras testadas aqui:
 *  - copia tudo menos id/status/contadores (novo status = running, zera);
 *  - só entra quem tem log `err` E NUNCA teve log `ok` (quem já recebeu
 *    algo não leva mensagem duplicada);
 *  - nome ganha o sufixo "(reenvio)";
 *  - 404 inexistente, 409 em andamento, 409 sem falha, 400 sem id.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── fake do supabase-js (só o que a rota usa) ─────────────────────────
const estado = {
  tabelas: {} as Record<string, any[]>,
  inserido: null as any,
};

function builder(tabela: string) {
  const filtros: Array<[string, any]> = [];
  let inserido: any = null;
  const b: any = {
    select(cols: string) {
      b._select = cols;
      return b;
    },
    eq(col: string, val: any) {
      filtros.push([col, val]);
      return b;
    },
    insert(row: any) {
      inserido = row;
      return b;
    },
    _linhas() {
      let l = [...(estado.tabelas[tabela] || [])];
      for (const [c, v] of filtros) l = l.filter((x) => x[c] === v);
      return l;
    },
    maybeSingle: async () => ({ data: b._linhas()[0] ?? null, error: null }),
    single: async () => {
      if (inserido) {
        estado.inserido = inserido;
        return { data: { ...inserido, id: "novo-id" }, error: null };
      }
      const l = b._linhas();
      return l.length
        ? { data: l[0], error: null }
        : { data: null, error: { message: "0 rows" } };
    },
    then: (res: any, rej: any) =>
      Promise.resolve({ data: b._linhas(), error: null }).then(res, rej),
  };
  return b;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => builder(t) }),
}));
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://teste.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-teste");

import { POST } from "./route";

function req(body: any) {
  return new NextRequest("http://localhost/api/bulk/campaigns/reenviar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIG = {
  id: "disp-1",
  name: "GD 30%",
  nome: "GD 30%",
  message: "Olá {{nome}}, desconto de 30%",
  fluxo_mensagens: [{ type: "text", content: "Oi" }],
  status: "completed",
  numbers: [
    { nome: "", telefone: "62981598253" },
    { nome: "", telefone: "61998614530" },
    { nome: "", telefone: "61998267707" },
    { nome: "", telefone: "64999585372" },
  ],
  instancia: "STK-2",
  instance_name: "STK-2",
  intervalo: 7,
  intervalo_passos: 3,
  delay_inicial: 0,
  campanha_id: "camp-1",
  promocao_id: null,
  imagem_url: "https://x/img.png",
  tipo: "avulso",
  tipo_envio: "text",
  sent: 1,
  failed: 3,
  delivered: 0,
  read_count: 0,
  error_log: "LID",
  created_at: "2026-10-05T21:00:00Z",
  updated_at: "2026-10-05T22:00:00Z",
};

const LOGS = [
  { campaign_id: "disp-1", contact_phone: "62981598253", contact_name: "Ana", status: "err", step_index: 0 },
  { campaign_id: "disp-1", contact_phone: "61998614530", contact_name: "", status: "err", step_index: 0 },
  // parcial: recebeu o passo 0 e errou no 1 — NÃO entra (evita duplicar o 0)
  { campaign_id: "disp-1", contact_phone: "61998267707", contact_name: "", status: "ok", step_index: 0 },
  { campaign_id: "disp-1", contact_phone: "61998267707", contact_name: "", status: "err", step_index: 1 },
  // sucesso total — não entra
  { campaign_id: "disp-1", contact_phone: "64999585372", contact_name: "", status: "ok", step_index: 0 },
];

beforeEach(() => {
  estado.tabelas = {
    bulk_campaigns: [{ ...ORIG }],
    disparo_logs: LOGS.map((l, i) => ({ id: `log-${i}`, ...l })),
  };
  estado.inserido = null;
});

describe("POST /api/bulk/campaigns/reenviar — só as falhas", () => {
  it("reenfileira apenas quem falhou sem nunca receber (201)", async () => {
    const res = await POST(req({ id: "disp-1" }));
    const body = await res.json();
    expect(res.status).toBe(201);

    const novo = estado.inserido;
    expect(novo.status).toBe("running");
    expect(novo.sent).toBe(0);
    expect(novo.failed).toBe(0);
    expect(novo.delivered).toBe(0);
    expect(novo.read_count).toBe(0);
    expect(novo.error_log).toBeNull();
    // só A e B (err puro); parcial e sucesso de fora
    expect(novo.numbers).toEqual([
      { nome: "Ana", telefone: "62981598253" },
      { nome: "", telefone: "61998614530" },
    ]);
    expect(novo.name).toBe("GD 30% (reenvio)");
    expect(novo.nome).toBe("GD 30% (reenvio)");
    // cópia integral do restante
    expect(novo.instancia).toBe("STK-2");
    expect(novo.campanha_id).toBe("camp-1");
    expect(novo.message).toBe(ORIG.message);
    expect(novo.fluxo_mensagens).toEqual(ORIG.fluxo_mensagens);
    expect(novo.intervalo).toBe(7);
    expect(novo.intervalo_passos).toBe(3);
    expect(novo.imagem_url).toBe("https://x/img.png");
    expect(novo.id).toBeUndefined();
    expect(novo.created_at).toBeUndefined();
    expect(body.disparo.id).toBe("novo-id");
  });

  it("404 quando o disparo não existe", async () => {
    const res = await POST(req({ id: "nao-existe" }));
    expect(res.status).toBe(404);
  });

  it("409 quando o original ainda está em andamento", async () => {
    estado.tabelas.bulk_campaigns[0].status = "running";
    const res = await POST(req({ id: "disp-1" }));
    expect(res.status).toBe(409);
  });

  it("409 quando não há nenhuma falha registrada", async () => {
    estado.tabelas.disparo_logs = LOGS.filter((l) => l.status === "ok").map(
      (l, i) => ({ id: `ok-${i}`, ...l })
    );
    const res = await POST(req({ id: "disp-1" }));
    expect(res.status).toBe(409);
  });

  it("400 quando falta o id", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
