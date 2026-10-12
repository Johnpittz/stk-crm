/**
 * MELHORIA 12/10 — imagens de REFERÊNCIA (logo, fotos) no estilo
 * AUTOIMAGEM: o admin sobe, o prompt ganha markers {{nome}} e a rota
 * de geração manda as imagens junto pro Gemini.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createAdminClient: () => ({
      from: (t: string) => cenario.builder(t),
      storage: cenario.storage,
    }),
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
  uploadMediaToStorage: vi.fn(async () => "https://fake.local/storage/media/referencias/x.png"),
}));

import { cenario } from "@/lib/testes/supabase-fake";
import { uploadMediaToStorage } from "@/lib/media-storage";
import { GET, POST, DELETE } from "./route";

function req(url = "http://localhost/api/marketing/artes/referencias", init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

beforeEach(() => {
  cenario.limpar();
  cenario.estado.usuario = { id: "u1", email: "u1@x.com" };
  cenario.tabelas.artes_referencias = [];
  vi.mocked(uploadMediaToStorage).mockClear();
});

describe("GET /api/marketing/artes/referencias", () => {
  it("exige sessão", async () => {
    cenario.estado.usuario = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("devolve a lista de referências", async () => {
    cenario.tabelas.artes_referencias.push({
      id: "r1", nome: "Logo STK", marker: "logo_stk",
      imagem_url: "https://fake/logo.png", ativo: true, created_by: "u1",
    });
    const res = await GET(req());
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo.referencias).toHaveLength(1);
    expect(corpo.referencias[0].marker).toBe("logo_stk");
  });
});

describe("POST /api/marketing/artes/referencias", () => {
  const png = {
    nome: "Logo STK",
    mimetype: "image/png",
    base64: Buffer.from("fake-image-bytes").toString("base64"),
  };

  it("sobe a imagem, guarda a URL e marca o {{marker}} slugificado", async () => {
    const res = await POST(req("http://localhost/api/marketing/artes/referencias", {
      method: "POST",
      body: JSON.stringify(png),
    }));
    expect(res.status).toBe(201);
    const corpo = await res.json();
    expect(corpo.referencia.marker).toBe("logo_stk");
    expect(corpo.referencia.imagem_url).toContain("referencias");
    expect(uploadMediaToStorage).toHaveBeenCalledTimes(1);
    const [b64, mime, prefix] = vi.mocked(uploadMediaToStorage).mock.calls[0];
    expect(mime).toBe("image/png");
    expect(prefix).toBe("referencias");
    expect(b64).toBe(png.base64);
    expect(cenario.tabelas.artes_referencias).toHaveLength(1);
  });

  it("recusa arquivo que não é imagem", async () => {
    const res = await POST(req("http://localhost/api/marketing/artes/referencias", {
      method: "POST",
      body: JSON.stringify({ ...png, mimetype: "application/pdf" }),
    }));
    expect(res.status).toBe(400);
    expect(uploadMediaToStorage).not.toHaveBeenCalled();
    expect(cenario.tabelas.artes_referencias).toHaveLength(0);
  });
});

describe("DELETE /api/marketing/artes/referencias", () => {
  it("apaga a própria referência; a de outro fica", async () => {
    cenario.tabelas.artes_referencias = [
      { id: "r1", nome: "Minha", marker: "minha", imagem_url: "u", ativo: true, created_by: "u1" },
      { id: "r2", nome: "Alheia", marker: "alheia", imagem_url: "u", ativo: true, created_by: "outra" },
    ];
    const ok = await DELETE(req("http://localhost/api/marketing/artes/referencias?id=r1", { method: "DELETE" }));
    expect(ok.status).toBe(200);
    expect(cenario.tabelas.artes_referencias.map((r: any) => r.id)).toEqual(["r2"]);
    const proibido = await DELETE(req("http://localhost/api/marketing/artes/referencias?id=r2", { method: "DELETE" }));
    expect(proibido.status).toBe(404);
    expect(cenario.tabelas.artes_referencias).toHaveLength(1);
  });
});
