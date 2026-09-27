"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Loader2,
  Inbox,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_FILA,
  ROTULO_STATUS,
  COR_STATUS,
  type StatusFila,
} from "@/lib/axs/fila";

/**
 * Fase 3 / C3 — tela da fila "cadastrar no CRM → criar na AXS".
 *
 * Mostra pendentes / enviando / criadas / erros e permite:
 *  - "Tentar de novo" (retry) — volta o item para `pendente` com contador zerado;
 *  - "Marcar como feita manualmente" — congela o item e avança o funil.
 * O envio em si é do worker (worker/fila_axs.py).
 */

interface ItemFila {
  id: string;
  cliente_id: string;
  oportunidade_id: string | null;
  vendedor_id: string | null;
  status: StatusFila;
  tentativas: number;
  max_tentativas: number;
  job_id: string | null;
  axs_card_id: string | null;
  erro: string | null;
  origem: string;
  payload: Record<string, any>;
  created_at: string;
  updated_at: string;
}

function dataCurta(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FilaAxsPage() {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusFila | "todos">("todos");
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/axs/fila", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.erros) && data.erros.length
            ? data.erros.join(" — ")
            : data.error || "Falha ao carregar a fila"
        );
      }
      setItens(data.itens || []);
      setErro(null);
    } catch (e: any) {
      setErro(e.message || "Falha ao carregar a fila");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 15000);
    return () => clearInterval(timer);
  }, [carregar]);

  const contagem = useMemo(() => {
    const mapa: Record<string, number> = { todos: itens.length };
    for (const s of STATUS_FILA) mapa[s] = 0;
    for (const i of itens) mapa[i.status] = (mapa[i.status] || 0) + 1;
    return mapa;
  }, [itens]);

  const visiveis = useMemo(
    () => (filtro === "todos" ? itens : itens.filter((i) => i.status === filtro)),
    [itens, filtro]
  );

  async function agir(id: string, acao: "retry" | "manual") {
    const confirmacao =
      acao === "retry"
        ? "Reenfileirar esta proposta? Ela será enviada para a AXS de novo."
        : "Marcar esta proposta como feita manualmente? O item sai da fila e a oportunidade avança no funil.";
    if (!window.confirm(confirmacao)) return;

    setEmAndamento(id);
    setAviso(null);
    try {
      const res = await fetch("/api/axs/fila", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na ação");
      setAviso(
        acao === "retry"
          ? "Proposta reenfileirada — o worker vai tentar de novo em instantes."
          : "Proposta marcada como feita manualmente."
      );
      await carregar();
    } catch (e: any) {
      setErro(e.message || "Falha na ação");
    } finally {
      setEmAndamento(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Inbox className="h-6 w-6 text-[#3B64CF]" />
            Fila AXS
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Propostas cadastradas no CRM aguardando criação na AXS. O worker envia,
            retenta em caso de erro e confirma quando a proposta nasce.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-white/5"
          onClick={() => {
            setCarregando(true);
            carregar();
          }}
          disabled={carregando}
        >
          {carregando ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm px-4 py-3">
          {aviso}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltro("todos")}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
            filtro === "todos"
              ? "border-[#3B64CF] bg-[#3B64CF]/15 text-white"
              : "border-[#1c2e4a] text-slate-400 hover:text-white hover:border-[#3B64CF]/40"
          }`}
        >
          Todos ({contagem.todos})
        </button>
        {STATUS_FILA.map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              filtro === s
                ? "border-[#3B64CF] bg-[#3B64CF]/15 text-white"
                : "border-[#1c2e4a] text-slate-400 hover:text-white hover:border-[#3B64CF]/40"
            }`}
          >
            {ROTULO_STATUS[s]} ({contagem[s] || 0})
          </button>
        ))}
      </div>

      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            {filtro === "todos" ? "Todos os itens" : ROTULO_STATUS[filtro]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando && itens.length === 0 && (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando fila...
            </div>
          )}

          {!carregando && visiveis.length === 0 && !erro && (
            <div className="py-10 text-center text-slate-500 text-sm">
              Nenhum item {filtro === "todos" ? "na fila" : `com status "${ROTULO_STATUS[filtro]}"`}.
            </div>
          )}

          {visiveis.map((item) => {
            const nome = item.payload?.nome || "Sem nome";
            const ocupado = emAndamento === item.id;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-[#1c2e4a] bg-[#0f1d32] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {nome}
                      </span>
                      <Badge
                        className={`text-[10px] border ${COR_STATUS[item.status] || ""}`}
                      >
                        {ROTULO_STATUS[item.status] || item.status}
                      </Badge>
                      {item.origem === "manual" && (
                        <Badge className="text-[10px] border border-slate-500/40 bg-slate-500/15 text-slate-300">
                          manual
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {dataCurta(item.created_at)}
                      </span>
                      <span>
                        tentativas {item.tentativas}/{item.max_tentativas}
                      </span>
                      {item.job_id && <span>job {item.job_id}</span>}
                      {item.axs_card_id && <span>card {item.axs_card_id}</span>}
                      <Link
                        href={`/clientes/${item.cliente_id}`}
                        className="inline-flex items-center gap-1 text-[#6ba3d6] hover:underline"
                      >
                        abrir cliente <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>

                    {item.erro && (
                      <p className="mt-2 text-xs text-red-300/90 break-words">
                        {item.erro}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(item.status === "erro" || item.status === "manual") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-white/5"
                        disabled={ocupado}
                        onClick={() => agir(item.id, "retry")}
                      >
                        {ocupado ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Tentar de novo
                      </Button>
                    )}
                    {(item.status === "erro" ||
                      item.status === "pendente" ||
                      item.status === "enviando") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-white/5"
                        disabled={ocupado}
                        onClick={() => agir(item.id, "manual")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Feita manualmente
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
