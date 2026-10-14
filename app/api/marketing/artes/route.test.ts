/**
 * PEDIDO 3 (11/10) — /api/marketing/artes: galeria + geração via Gemini.
 *
 * Supabase fakeado (auth + storage), Gemini stubado no fetch global e o
 * upload de mídia stubado — sem rede. Fluxo: prompt guiado → Gemini
 * (Nano Banana) → bucket media → linha em `artes`.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createAdminClient: () => ({ from: (t: string) => cenario.builder(t) }),
  };
});

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

vi.mock("@/lib/media-storage", () => ({
  uploadMediaToStorage: vi.fn(async () => "https://fake.local/media/artes/arte1.png"),
}));

import { uploadMediaToStorage } from "@/lib/media-storage";
import { cenario } from "@/lib/testes/supabase-fake";
import { GET, POST, DELETE } from "./route";

function logar(id: string, cargo = "admin") {
  cenario.estado.usuario = { id, email: `${id}@x.com`, cargo };
  cenario.tabelas.profiles = [{ id, cargo, nome_completo: id }];
}

function req(url = "http://localhost/api/marketing/artes", init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

const corpoOk = {
  formato: "feed_insta",
  assunto: "Painéis solares",
  texto: "Economize até 40%",
};

/** Resposta "com imagem" no formato do Gemini (Nano Banana). */
function geminiComImagem() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }] } },
      ],
    }),
  };
}

describe("GET /api/marketing/artes — galeria", () => {
  beforeEach(() => {
    cenario.limpar();
    vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("401 sem sessão", async () => {
    cenario.estado.usuario = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("200 devolvendo as artes em ordem de criação", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.artes = [
      { id: "a1", titulo: "Arte A", formato: "feed_insta", created_at: "2026-10-10T10:00:00Z" },
      { id: "a2", titulo: "Arte B", formato: "story", created_at: "2026-10-11T10:00:00Z" },
    ];
    const res = await GET(req());
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.artes).toHaveLength(2);
    // mais nova primeiro (order created_at desc)
    expect(corpo.artes[0].id).toBe("a2");
  });
});

describe("POST /api/marketing/artes — gerar com Gemini", () => {
  beforeEach(() => {
    cenario.limpar();
    vi.stubEnv("GEMINI_API_KEY", "chave-teste");
    vi.stubEnv("XIAOMI_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("401 sem sessão", async () => {
    cenario.estado.usuario = null;
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify(corpoOk),
    }));
    expect(res.status).toBe(401);
  });

  it("503 quando a GEMINI_API_KEY não está no ambiente", async () => {
    logar("ven-1");
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify(corpoOk),
    }));
    expect(res.status).toBe(503);
    const corpo = await res.json();
    expect(corpo.error).toMatch(/GEMINI_API_KEY/);
  });

  it("MELHORIA 12/10: com referência ativa, a imagem vai junto no Gemini", async () => {
    logar("adm-1");
    vi.stubEnv("GEMINI_API_KEY", "chave");
    cenario.tabelas.artes_referencias = [
      { id: "r1", nome: "Logo", marker: "logo", imagem_url: "https://fake.local/logo.png", ativo: true, created_by: "adm" },
    ];
    const fetchMock = vi.fn(async (url: any, init?: RequestInit) => {
      if (String(url).includes("generativelanguage")) {
        return {
          ok: true, status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zm90bw==" } }] } }] }),
        };
      }
      return {
        ok: true, status: 200,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify({ ...corpoOk, observacoes: "usar o logo {{logo}}" }),
    }));
    expect(res.status).toBe(201);
    const gemini = fetchMock.mock.calls.find(([u]) => String(u).includes("generativelanguage"));
    const body = JSON.parse(String((gemini![1] as RequestInit).body));
    const parts = body.contents[0].parts;
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(parts)).toContain("inlineData");
    expect(JSON.stringify(parts)).not.toContain("{{logo}}");
    const listaRes = await GET(req());
    const lista = await listaRes.json();
    expect(lista.artes[0].prompt).toContain("{{logo}}");
  });

  it("400 para formato fora do catálogo (sem chamar a IA)", async () => {
    logar("ven-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify({ ...corpoOk, formato: "tiktok" },
      ),
    }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("201: prompt montado → Gemini → upload → linha em artes", async () => {
    logar("ven-1");
    const fetchMock = vi.fn(async () => geminiComImagem());
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify(corpoOk),
    }));
    expect(res.status).toBe(201);
    const corpo = await res.json();
    expect(corpo.arte.imagem_url).toContain("artes/");
    expect(corpo.arte.status).toBe("pronta");
    expect(corpo.arte.titulo).toBe("Painéis solares");
    expect(cenario.tabelas.artes).toHaveLength(1);
    expect(cenario.tabelas.artes[0].formato).toBe("feed_insta");
    expect(uploadMediaToStorage).toHaveBeenCalledTimes(1);
    // o prompt gerado leva o texto que o vendedor pediu
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-2.5-flash-image");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toContain("Economize até 40%");
    // MELHORIA 13/10: formato feed vai como proporção 1:1 pro Gemini
    expect(body.generationConfig.imageConfig.aspectRatio).toBe("1:1");
  });

  it("MELHORIA 13/10: story (9:16) chega no Gemini como aspectRatio 9:16", async () => {
    logar("ven-1");
    const fetchMock = vi.fn(async () => geminiComImagem());
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify({ ...corpoOk, formato: "story" }),
    }));
    expect(res.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.imageConfig.aspectRatio).toBe("9:16");
  });

  it("502 quando o Gemini não devolve imagem (galeria não fica suja)", async () => {
    logar("ven-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "recusei" }] } }] }),
      })),
    );
    const res = await POST(req("http://localhost/api/marketing/artes", {
      method: "POST",
      body: JSON.stringify(corpoOk),
    }));
    expect(res.status).toBe(502);
    expect(cenario.tabelas.artes ?? []).toHaveLength(0);
  });
});

describe("DELETE /api/marketing/artes?id=", () => {
  beforeEach(() => cenario.limpar());
  afterEach(() => vi.unstubAllEnvs());

  it("401 sem sessão", async () => {
    cenario.estado.usuario = null;
    const res = await DELETE(req("http://localhost/api/marketing/artes?id=a1", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("vendedor apaga a própria arte", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.artes = [
      { id: "a1", titulo: "minha", created_by: "ven-1" },
      { id: "a2", titulo: "de outro", created_by: "ven-2" },
    ];
    const res = await DELETE(req("http://localhost/api/marketing/artes?id=a1", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(cenario.tabelas.artes).toHaveLength(1);
    expect(cenario.tabelas.artes[0].id).toBe("a2");
  });

  it("não apaga a arte de outro vendedor (404)", async () => {
    logar("ven-1", "vendedor");
    cenario.tabelas.artes = [{ id: "a2", titulo: "de outro", created_by: "ven-2" }];
    const res = await DELETE(req("http://localhost/api/marketing/artes?id=a2", { method: "DELETE" }));
    expect(res.status).toBe(404);
    expect(cenario.tabelas.artes).toHaveLength(1);
  });
});
