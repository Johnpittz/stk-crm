"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, TrendingUp, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface PerformanceKanbanProps {
  refreshTrigger?: number;
}

interface ResumoData {
  periodo: string;
  total_vendas: number;
  quantidade_vendas: number;
  ticket_medio: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function PerformanceKanban({ refreshTrigger }: PerformanceKanbanProps) {
  const [resumo, setResumo] = useState<ResumoData | null>(null);
  const [periodo, setPeriodo] = useState<"dia" | "mes" | "ano">("dia");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchResumo = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const hoje = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `/api/tarefas/resumo?periodo=${periodo}&data=${hoje}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResumo(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo, refreshTrigger]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Performance
        </span>
        <div className="flex items-center gap-1 bg-[#14233c] rounded-lg p-0.5">
          {(["dia", "mes", "ano"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant="ghost"
              className={cn(
                "h-6 text-[10px] px-2.5 rounded-md",
                periodo === p
                  ? "bg-[#15317B] text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              onClick={() => setPeriodo(p)}
            >
              {p === "dia" ? "Dia" : p === "mes" ? "Mês" : "Ano"}
            </Button>
          ))}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-3 gap-3">
        {/* TOTAL VENDIDO */}
        <Card className="border border-[#1c2e4a] bg-[#14233c] hover:bg-[#1a2d47] transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#15317B]/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-[#3B64CF]" />
              </div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Total Vendido
              </span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(resumo?.total_vendas || 0)}
            </p>
          </CardContent>
        </Card>

        {/* TICKET MÉDIO */}
        <Card className="border border-[#1c2e4a] bg-[#14233c] hover:bg-[#1a2d47] transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#2556B3]/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#2556B3]" />
              </div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Ticket Médio
              </span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(resumo?.ticket_medio || 0)}
            </p>
          </CardContent>
        </Card>

        {/* TOTAL DE VENDAS */}
        <Card className="border border-[#1c2e4a] bg-[#14233c] hover:bg-[#1a2d47] transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#15317B]/20 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-[#3B64CF]" />
              </div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Total de Vendas
              </span>
            </div>
            <p className="text-xl font-bold text-white">
              {resumo?.quantidade_vendas || 0}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
