/**
 * PEDIDO 3 (11/10) — geração de imagem com o Google Gemini ("Nano
 * Banana"), a mesma receita do projeto AUTOIMAGEM (que já roda em
 * produção aqui): POST v1beta/models/<modelo>:generateContent com
 * header x-goog-api-key; a imagem volta em
 * candidates[].content.parts[] como inlineData base64.
 *
 * LANÇA em qualquer falha (sem chave, HTTP != 200, resposta sem
 * imagem) — a rota converte em erro HTTP e a galeria não fica suja.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const MODELO_PADRAO = "gemini-2.5-flash-image";

export interface ImagemGerada {
  data: string;
  mimeType: string;
}

/** Extrai a primeira imagem (inlineData) do corpo de resposta do Gemini. */
export function extrairImagemDoCorpo(corpo: unknown): ImagemGerada | null {
  const candidatos = (corpo as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidatos)) return null;
  for (const candidato of candidatos) {
    const partes = (candidato as { content?: { parts?: unknown } })?.content?.parts;
    if (!Array.isArray(partes)) continue;
    for (const bruto of partes) {
      const part = bruto as {
        inlineData?: { mimeType?: string; mime_type?: string; data?: string };
        inline_data?: { mimeType?: string; mime_type?: string; data?: string };
      };
      const dados = part.inlineData ?? part.inline_data;
      if (dados?.data) {
        return {
          data: dados.data,
          mimeType: dados.mimeType ?? dados.mime_type ?? "image/png",
        };
      }
    }
  }
  return null;
}

function mensagemDeErro(corpo: unknown, status: number): string {
  const err = (corpo as { error?: { message?: string } })?.error;
  return err?.message ?? `HTTP ${status}`;
}

export async function gerarImagemGemini(p: {
  apiKey?: string;
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ImagemGerada> {
  const chave = (p.apiKey ?? "").trim();
  if (!chave) {
    throw new Error("GEMINI_API_KEY ausente — cadastre a chave no ambiente (Vercel).");
  }
  const modelo = (p.model ?? "").trim() || MODELO_PADRAO;
  const url = `${BASE}/models/${encodeURIComponent(modelo)}:generateContent`;

  const fetchImpl = p.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: p.prompt }] }],
      }),
      signal: AbortSignal.timeout(p.timeoutMs ?? 50_000),
    });
  } catch (err: any) {
    throw new Error(`Falha ao falar com o Gemini: ${err?.message ?? err}`);
  }

  let corpo: unknown = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `A chave da API do Google foi recusada (${res.status}). Confira a GEMINI_API_KEY. Detalhe: ${mensagemDeErro(corpo, res.status)}`,
    );
  }
  if (!res.ok) {
    throw new Error(`Gemini recusou a geração (HTTP ${res.status}): ${mensagemDeErro(corpo, res.status)}`);
  }

  const imagem = extrairImagemDoCorpo(corpo);
  if (!imagem) {
    const texto = (corpo as any)?.candidates?.[0]?.content?.parts?.find((x: any) => x.text)?.text;
    throw new Error(`O Gemini não devolveu imagem.${texto ? ` Resposta: ${String(texto).slice(0, 200)}` : ""}`);
  }
  return imagem;
}
