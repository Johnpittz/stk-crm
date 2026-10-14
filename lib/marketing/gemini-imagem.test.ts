import { describe, it, expect, vi, afterEach } from "vitest";
import { gerarImagemGemini, extrairImagemDoCorpo } from "./gemini-imagem";

/**
 * PEDIDO 3 (11/10) — geração de imagem com o Gemini (Nano Banana).
 *
 * Receita copiada do AUTOIMAGEM (repo Johnpittz/autoimagem, já testado
 * em produção): POST v1beta/models/<modelo>:generateContent com header
 * x-goog-api-key, e a imagem volta em candidates[].content.parts[]
 * como inlineData base64.
 */
describe("extrairImagemDoCorpo", () => {
  it("acha inlineData em candidates e devolve data + mimeType", () => {
    const corpo = {
      candidates: [
        { content: { parts: [{ text: "aqui não" }, { inlineData: { mimeType: "image/png", data: "QUJD" } }] } },
      ],
    };
    expect(extrairImagemDoCorpo(corpo)).toEqual({ data: "QUJD", mimeType: "image/png" });
  });

  it("devolve null quando o modelo só respondeu texto", () => {
    expect(extrairImagemDoCorpo({ candidates: [{ content: { parts: [{ text: "sem imagem" }] } }] })).toBe(null);
    expect(extrairImagemDoCorpo({})).toBe(null);
  });
});

describe("gerarImagemGemini", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sem GEMINI_API_KEY lança antes de qualquer chamada de rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      gerarImagemGemini({ apiKey: "", prompt: "arte", fetchImpl: fetchMock as any }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST no endpoint certo com x-goog-api-key e devolve a imagem", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "BASE64==" } }] } }],
      }),
    }));
    const img = await gerarImagemGemini({
      apiKey: "chave-teste",
      prompt: "uma arte de painéis solares",
      fetchImpl: fetchMock as any,
    });
    expect(img).toEqual({ data: "BASE64==", mimeType: "image/png" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-2.5-flash-image:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("chave-teste");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toContain("painéis solares");
  });

  it("MELHORIA 12/10: aceita partes prontas (texto + imagens de referência)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zm90bw==" } }] } }],
      }),
    }));
    await gerarImagemGemini({
      apiKey: "chave",
      prompt: "usado só quando não há partes",
      partes: [
        { text: "edite esta foto" },
        { inlineData: { mimeType: "image/png", data: "bG9nbw==" } },
      ],
      fetchImpl: fetchMock as any,
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.contents[0].parts).toHaveLength(2);
    expect(body.contents[0].parts[0].text).toBe("edite esta foto");
    expect(body.contents[0].parts[1].inlineData.data).toBe("bG9nbw==");
  });

  it("MELHORIA 13/10: aspectRatio vira generationConfig.imageConfig.aspectRatio", async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zm90bw==" } }] } },
        ],
      }),
    }));
    await gerarImagemGemini({
      apiKey: "k", prompt: "story", aspectRatio: "9:16", fetchImpl: fetchMock as any,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.imageConfig.aspectRatio).toBe("9:16");
    const sem = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zg==" } }] } },
        ],
      }),
    }));
    await gerarImagemGemini({ apiKey: "k", prompt: "p", fetchImpl: sem as any });
    const body2 = JSON.parse(String((sem.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body2.generationConfig).toBeUndefined();
  });

  it("MELHORIA 13/10: descarta chaves extras das partes (API do Gemini só aceita text/inlineData)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zm90bw==" } }] } },
        ],
      }),
    }));
    await gerarImagemGemini({
      apiKey: "k",
      prompt: "p",
      partes: [
        { type: "text", text: "antes" },
        { inlineData: { mimeType: "image/png", data: "Zg==" } },
      ],
      fetchImpl: fetchMock as any,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const parts = body.contents[0].parts;
    expect(parts).toEqual([
      { text: "antes" },
      { inlineData: { mimeType: "image/png", data: "Zg==" } },
    ]);
    expect(String(init.body)).not.toContain('"type"');
  });

  it("HTTP 401 (chave recusada) lança mensagem clara", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "API key not valid" } }),
      })),
    );
    await expect(gerarImagemGemini({ apiKey: "k", prompt: "p" })).rejects.toThrow(/chave/i);
  });

  it("resposta sem imagem lança (não devolve sucesso vazio)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "recusei" }] } }] }),
      })),
    );
    await expect(gerarImagemGemini({ apiKey: "k", prompt: "p" })).rejects.toThrow(/imagem/i);
  });
});
