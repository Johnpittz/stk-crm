import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 19/10 — guarda o ARQUIVO da conta (o PDF em si, não só os números) no
 * Storage: é o que permite "Reanalisar" reler a conta já inserida sem
 * pedir o arquivo de novo. Bucket privado; acesso só pela service role.
 */
export const BUCKET = "faturas-contas";

export function caminhoArquivoFatura(
  clienteId: string,
  nome: string,
  agora = Date.now()
): string {
  let seguro = (nome || "").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  // nome só com símbolo não vira caminho inútil
  if (!/[A-Za-z0-9]/.test(seguro)) seguro = "conta.pdf";
  return `${clienteId}/${agora}-${seguro}`;
}

/** Guarda o arquivo; nunca derruba o fluxo — null = não guardou. */
export async function guardarArquivoFatura(
  admin: SupabaseClient,
  clienteId: string,
  arquivo: File
): Promise<string | null> {
  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    // idempotente: cria o bucket na primeira subida (se já existir, segue)
    await admin.storage.createBucket(BUCKET, { public: false });
    const caminho = caminhoArquivoFatura(clienteId, arquivo.name);
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(caminho, bytes, {
        contentType: arquivo.type || "application/octet-stream",
        upsert: true,
      });
    return error ? null : caminho;
  } catch (erro) {
    console.error("[arquivo-fatura] guardar:", (erro as Error)?.message ?? erro);
    return null;
  }
}

/** Abre um arquivo guardado; null = não achou (linha antiga, etc.). */
export async function baixarArquivoFatura(
  admin: SupabaseClient,
  caminho: string
): Promise<{ bytes: Buffer; nome: string } | null> {
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(caminho);
    if (error || !data) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    const nome = caminho.split("/").pop() || "conta.pdf";
    return { bytes, nome };
  } catch (erro) {
    console.error("[arquivo-fatura] baixar:", (erro as Error)?.message ?? erro);
    return null;
  }
}
