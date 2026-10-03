/**
 * Preparação do disparo em massa — bug 03/10 (imagem virava arquivo 422 KB).
 *
 * A tela de Marketing > Campanhas gravava `fluxo_mensagens` direto no banco
 * com o prefixo `data:image/jpeg;base64,` (FileReader) e SEM subir a imagem
 * pro Storage; o robô mandava esse valor pra WAHA (que exige base64 puro) e a
 * decodificação saía corrompida — prova medida em produção: fileLength 432548
 * com prefixo (mágica 75ab5a8a, ≠ JPEG) vs 432533 limpo (ffd8ffe0).
 *
 * Regras daqui:
 * 1. imagem do fluxo SOBE pro Storage e o passo vira {type:'image', url, mimetype};
 * 2. qualquer base64 que sair daqui já sai SEM prefixo (defesa dupla: o robô
 *    também limpa em `limpar_base64`);
 * 3. a lista `numbers` só pode ter TELEFONES — a instância no topo ('STK-3')
 *    virava chatId '553@c.us' e a WAHA respondia timeout.
 */

export interface PassoFluxo {
  type: 'text' | 'image'
  content?: string
  base64?: string
  mimetype?: string
  url?: string
  filename?: string
}

/** Sobe uma imagem limpa pro Storage e devolve a URL pública (ou null). */
export type UploadImagem = (
  base64: string,
  mimetype: string,
) => Promise<string | null>

/** Remove o prefixo data:...;base64, do FileReader. */
export function limparBase64(valor: string): string {
  return String(valor ?? '').replace(/^data:[^;,]+;base64,/, '')
}

/** true se o valor parece telefone (>=10 dígitos) — 'STK-3' não é contato. */
export function ehTelefone(valor: unknown): boolean {
  const digits = String(valor ?? '').replace(/\D/g, '')
  return digits.length >= 10
}

/**
 * Monta a coluna `numbers` da campanha: só contatos válidos.
 * (Antes a instância era prefixada na lista em massa/avulso — só o remarketing
 * estava corrigido.)
 */
export function montarNumbers(
  contatos: Array<{ nome?: string; telefone?: string } | string>,
): Array<{ nome: string; telefone: string }> {
  return contatos
    .map((c) =>
      typeof c === 'string'
        ? { nome: '', telefone: c }
        : { nome: c.nome || '', telefone: c.telefone || '' },
    )
    .filter((c) => ehTelefone(c.telefone))
}

/**
 * Prepara os passos do fluxo para persistência/envio:
 * - texto → intacto;
 * - imagem COM url → intacta (não faz upload de novo);
 * - imagem em base64 → upload pro Storage; se o upload falhar, mantém o passo
 *   com o base64 **limpo** (o robô limpa de novo antes de enviar).
 * A ordem dos passos é sempre preservada.
 */
export async function prepararPassosDoFluxo(
  steps: PassoFluxo[],
  upload: UploadImagem,
): Promise<PassoFluxo[]> {
  const out: PassoFluxo[] = []
  for (const step of steps ?? []) {
    if (step.type !== 'image') {
      out.push(step)
      continue
    }
    if (step.url) {
      out.push(step)
      continue
    }

    const base64 = limparBase64(step.base64 || '')
    const mimetype = step.mimetype || ''
    if (!base64 || !mimetype) {
      // Sem tipo não dá pra subir (a extensão vem do MIME) — sai limpo mesmo.
      out.push({ ...step, base64 })
      continue
    }

    let url: string | null = null
    try {
      url = await upload(base64, mimetype)
    } catch {
      url = null
    }
    out.push(
      url
        ? { type: 'image', url, mimetype }
        : { ...step, base64, mimetype },
    )
  }
  return out
}
