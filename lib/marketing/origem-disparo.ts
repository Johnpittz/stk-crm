/**
 * PARTE 9 (16/10) — origem do disparo: qual número (instância WAHA)
 * foi usado. bulk_campaigns guarda só o nome da sessão (`instancia`);
 * o número vivo vem de /api/instances ({ instancias: [{name, number}] }).
 * Tudo puro e testado — a página só monta o mapa uma vez.
 */

/** Lista de /api/instances → mapa nome-da-sessão → número. */
export function mapearNumerosInstancias(
  instancias: Array<{ name?: string; number?: string }> | null | undefined
): Record<string, string> {
  const mapa: Record<string, string> = {};
  if (!Array.isArray(instancias)) return mapa;
  for (const i of instancias) {
    const nome = String(i?.name ?? "").trim();
    if (!nome) continue;
    mapa[nome] = String(i?.number ?? "").trim();
  }
  return mapa;
}

/** 5562999998888 → "+55 62 99999-8888" · 6436311824 → "64 3631-1824". */
export function formatarNumeroBR(bruto: string | null | undefined): string {
  const original = String(bruto ?? "");
  const digitos = original.replace(/\D/g, "");
  if (digitos.length < 10) return original;

  let n = digitos;
  let ddi = "";
  if (n.length >= 12 && n.startsWith("55")) {
    ddi = "+55 ";
    n = n.slice(2);
  }
  if (n.length === 10) {
    // fixo: DDD + 4 + 4
    return `${ddi}${n.slice(0, 2)} ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  if (n.length === 11) {
    // celular: DDD + 5 + 4
    return `${ddi}${n.slice(0, 2)} ${n.slice(2, 7)}-${n.slice(7)}`;
  }
  return original;
}

/**
 * O que a tela exibe por disparo:
 * número formatado · sem número → o próprio nome da sessão ·
 * sem instancia → null (a célula fica vazia).
 */
export function numeroDeOrigem(
  mapa: Record<string, string>,
  instancia: string | null | undefined
): string | null {
  const nome = String(instancia ?? "").trim();
  if (!nome) return null;
  const numero = mapa[nome];
  if (!numero) return nome;
  return formatarNumeroBR(numero);
}
