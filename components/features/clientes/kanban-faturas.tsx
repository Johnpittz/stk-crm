"use client";
/**
 * 18/10 — KANBAN DE FATURAS (pedido do João).
 *
 * O botão "Upload da Fatura" sumiu: agora existe só "Análise da Fatura".
 * O fluxo vira:
 *   1) vendedor escolhe o arquivo → a conta entra como CARD "Fatura
 *      Recebida" (uma linha de cliente_pasta_linhas, linha=gestao_fatura,
 *      fluxo=recebida);
 *   2) terminando a IA → o MESMO card vira "Fatura Analisada" e, ao
 *      clicar, abre o resumo que a IA leu (concessionária, UC, valor...).
 *
 * São duas colunas sobre a MESMA linha — sem tabela nova, sem duplicar.
 */
import { useCallback, useEffect, useState } from "react";
import { formatarCompetencia, formatarValor } from "@/lib/clientes/linhas";

interface Props {
  clienteId: string | null;
  onAnalisar?: () => void;
  chave?: number;
}

interface Resumo {
  concessionaria?: string | null;
  uc?: string | null;
  titular?: string | null;
  cnpj_cpf?: string | null;
  vencimento?: string | null;
  consumo?: string | null;
  valor?: string | null;
}

interface Card {
  id: string;
  competencia: string;
  valor: unknown;
  consumo: unknown;
  situacao: unknown;
  analisada: boolean;
  resumo: Resumo | null;
}

function paraNumero(bruto: unknown): number | null {
  const s = String(bruto ?? "").trim();
  if (!s) return null;
  const limpo = s.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const n = Number(
    limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
  );
  return Number.isFinite(n) ? n : null;
}

export function KanbanFaturas({ clienteId, onAnalisar, chave }: Props) {
  const [recebidas, setRecebidas] = useState<Card[]>([]);
  const [analisadas, setAnalisadas] = useState<Card[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<Card | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) {
      setRecebidas([]);
      setAnalisadas([]);
      setCarregando(false);
      return;
    }
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient()
        .from("cliente_pasta_linhas")
        .select("id, dados, created_at")
        .eq("cliente_id", clienteId)
        .eq("linha", "gestao_fatura")
        .order("created_at", { ascending: false });
      const cards: Card[] = (data ?? []).map((r: any) => ({
        id: r.id,
        competencia: String(r.dados?.competencia ?? ""),
        valor: r.dados?.valor ?? null,
        consumo: r.dados?.consumo_kwh ?? null,
        situacao: r.dados?.situacao ?? null,
        analisada: String(r.dados?.fluxo ?? "") === "analise-concluida",
        resumo: (r.dados?.resumo_analise ?? null) as Resumo | null,
      }));
      setRecebidas(cards.filter((c) => !c.analisada));
      setAnalisadas(cards.filter((c) => c.analisada));
    } catch {
      /* o kanban é conforto: a fatura já está gravada */
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar, chave]);

  const card = (c: Card, onClick?: () => void, ver = "ver →") => (
    <button
      key={c.id}
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 ${
        onClick
          ? "border-[#1c2e4a] bg-white/5 hover:bg-white/10"
          : "border-[#1c2e4a] bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">
          ⚡ {formatarCompetencia(c.competencia)}
        </span>
        {onClick && <span className="text-[10px] text-slate-400">{ver}</span>}
      </div>
      <p className="text-xs text-slate-400 mt-1">
        {formatarValor(paraNumero(c.valor))}
        {paraNumero(c.consumo) !== null ? ` · ${paraNumero(c.consumo)} kWh` : ""}
      </p>
      {c.situacao ? (
        <p className="text-[11px] text-slate-500 mt-0.5">{String(c.situacao)}</p>
      ) : null}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#1c2e4a] bg-[#0b1526]/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            📥 Fatura Recebida
          </p>
          <div className="space-y-2">
            {carregando && <p className="text-xs text-slate-500">carregando...</p>}
            {!carregando && recebidas.length === 0 && (
              <p className="text-xs text-slate-500">
                Nenhuma conta aguardando análise.
              </p>
            )}
            {recebidas.map((c) => card(c, onAnalisar, "reanalisar →"))}
          </div>
        </div>

        <div className="rounded-lg border border-[#1c2e4a] bg-[#0b1526]/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            ✅ Fatura Analisada
          </p>
          <div className="space-y-2">
            {carregando && <p className="text-xs text-slate-500">carregando...</p>}
            {!carregando && analisadas.length === 0 && (
              <p className="text-xs text-slate-500">
                Nenhuma conta analisada ainda.
              </p>
            )}
            {analisadas.map((c) => card(c, () => setAberta(c)))}
          </div>
        </div>
      </div>

      {aberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAberta(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#1c2e4a] bg-[#0f1d32] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-white">
                🧾 Fatura analisada — {formatarCompetencia(aberta.competencia)}
              </h3>
              <button
                type="button"
                onClick={() => setAberta(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-sm">
              {[
                ["Concessionária", aberta.resumo?.concessionaria],
                ["UC", aberta.resumo?.uc],
                ["Titular", aberta.resumo?.titular],
                ["CNPJ/CPF", aberta.resumo?.cnpj_cpf],
                ["Vencimento (dia)", aberta.resumo?.vencimento],
                ["Consumo", aberta.resumo?.consumo],
                ["Valor", aberta.resumo?.valor],
              ].map(([rot, val]) => (
                <div
                  key={String(rot)}
                  className="flex justify-between border-b border-white/5 py-1"
                >
                  <span className="text-slate-400">{rot}</span>
                  <span className="text-white">{val ? String(val) : "—"}</span>
                </div>
              ))}
            </div>
            {onAnalisar && (
              <button
                type="button"
                onClick={() => {
                  setAberta(null);
                  onAnalisar();
                }}
                className="mt-4 w-full rounded-md bg-[#3B64CF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2d50a8]"
              >
                🔍 Analisar novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
