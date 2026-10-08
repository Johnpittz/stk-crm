/**
 * Tempo legível para o Dashboard (UX — João: "não ficou intuitivo").
 * 0 → "na hora" · <60 → "X min" · <1440 → "Xh [Ymin]" · ≥1440 → "X dia(s) [Yh]"
 */
export function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos)) return "—";
  if (minutos < 1) return "na hora";

  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}min` : `${h}h`;
  }
  const dias = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const parteDias = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  return h > 0 ? `${parteDias} ${h}h` : parteDias;
}
