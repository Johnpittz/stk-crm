/**
 * Fase 1/2 — times de TESTE aprovados pelo João (06/10):
 * "Time Lobo" e "Time Águia", um número STK para cada.
 *
 * Os dois números STK disponíveis hoje (WAHA): STK-1 e STK-3
 * (STK-2 está FAILED — precisa de QR). As linhas em `equipes` foram
 * criadas com esses nomes; o vínculo número→time mora aqui enquanto o
 * cadastro real de equipes (e o `equipe_id` do vendedor) não existe.
 * Fase 2 lê este mapa para agrupar o tempo de resposta por time.
 */
export const EQUIPES_POR_INSTANCIA: Record<string, string> = {
  "STK-1": "Time Lobo",
  "STK-3": "Time Águia",
};

export function nomeDaEquipe(instancia?: string | null): string | null {
  if (!instancia) return null;
  return EQUIPES_POR_INSTANCIA[instancia] ?? null;
}
