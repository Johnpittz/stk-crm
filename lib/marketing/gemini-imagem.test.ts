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
