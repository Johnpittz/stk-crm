/**
 * Upload base64 media to Supabase Storage and return public URL.
 * Prevents egress bloat by storing files in Storage instead of database.
 */

import { createClient } from "@supabase/supabase-js";

let supabaseStorage: any = null;

function getStorageClient() {
  if (!supabaseStorage) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase credentials missing");
    supabaseStorage = createClient(url, key);
  }
  return supabaseStorage;
}

/**
 * Uploads a base64 data string to Supabase Storage bucket "media".
 * @param base64Data - Raw base64 string (without data: prefix)
 * @param mimeType - MIME type (e.g. "audio/ogg; codecs=opus")
 * @param prefix - Folder prefix (e.g. "audio", "image", "video")
 * @param fileName - Nome original do arquivo (extensão de fallback quando o
 *   mimetype não é revelador: application/octet-stream, mimetype vazio, …)
 * @returns Public URL or null on failure
 */
export async function uploadMediaToStorage(
  base64Data: string,
  mimeType: string,
  prefix: string,
  fileName?: string
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64Data, "base64");

    // Extensão a partir do MIME… ou do nome original quando o MIME é genérico
    const ext = extensaoArquivo(mimeType, fileName);
    const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const storage = getStorageClient();

    const { data, error } = await storage.storage
      .from("media")
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("[MediaStorage] Upload error:", error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = storage.storage
      .from("media")
      .getPublicUrl(data.path);

    console.log("[MediaStorage] Uploaded:", filename, "->", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err: any) {
    console.error("[MediaStorage] Error:", err.message);
    return null;
  }
}

/**
 * Resolve a extensão do arquivo: primeiro o mimetype (quando é específico),
 * depois o nome original. Regras corrigidas em relação à versão antiga:
 * - xlsx casava com "document" (openxml…officedocument…) e virava .docx;
 * - application/octet-stream / mimetype vazio caía sempre em .bin.
 */
export function extensaoArquivo(mime: string, fileName?: string): string {
  const m = (mime || "").toLowerCase();

  if (m) {
    if (m.includes("ogg") || m.includes("opus")) return "ogg";
    if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("webm")) return "webm";
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("png")) return "png";
    if (m.includes("webp")) return "webp";
    if (m.includes("gif")) return "gif";
    if (m.includes("pdf")) return "pdf";
    if (m.includes("csv")) return "csv";
    if (m.includes("plain")) return "txt";
    // Planilhas/apresentações ANTES de "document" (xlsx, pptx)
    if (m.includes("spreadsheet") || m.includes("excel")) return "xlsx";
    if (m.includes("presentation") || m.includes("powerpoint")) return "pptx";
    if (m.includes("wordprocessing") || m.includes("msword")) return "docx";
    if (m.includes("opendocument")) return "odt";
    if (m.includes("document")) return "docx";
  }

  // MIME não revelador → extensão do nome original
  if (fileName) {
    const ponto = fileName.lastIndexOf(".");
    if (ponto > 0 && ponto >= fileName.length - 8) {
      const ext = fileName.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (ext) return ext;
    }
  }

  return "bin";
}
