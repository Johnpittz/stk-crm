/**
 * 06/10 — STATUS do cliente: LEAD / PROSPECT / CLIENTE / CAPTADOR
 * (pedido do João, que a dropdown tivesse "essas opções").
 *
 * Valores antigos já gravados (ativo/churn/inativo) continuam válidos: se o
 * cliente estiver com um deles, ele aparece como opção extra rotulada
 * "(antigo)" — nada de dado perdido nem select em branco.
 */

export interface OpcaoStatus {
  valor: string;
  rotulo: string;
}

export const STATUS_NOVOS: OpcaoStatus[] = [
  { valor: "lead", rotulo: "Lead" },
  { valor: "prospect", rotulo: "Prospect" },
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "captador", rotulo: "Captador" },
];

export function opcoesStatus(atual?: string | null): OpcaoStatus[] {
  const valor = (atual || "").trim();
  if (!valor || STATUS_NOVOS.some((s) => s.valor === valor)) {
    return [...STATUS_NOVOS];
  }
  const rotulo =
    valor.charAt(0).toUpperCase() + valor.slice(1) + " (antigo)";
  return [...STATUS_NOVOS, { valor, rotulo }];
}
