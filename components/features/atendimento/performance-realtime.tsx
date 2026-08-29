"use client";

import { useState, useEffect, useCallback } from "react";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function PerformanceRealTime() {
  const [data, setData] = useState<{ totalVendas: number; meta: number; percentual: number } | null>(null);
  const supabase = createClient();

  const fetchResumo = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const hoje = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/tarefas/resumo?periodo=dia&data=${hoje}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const result = await res.json();
        setData({
          totalVendas: result.total_vendas || 0,
          meta: result.meta || 2000,
          percentual: result.percentual_meta || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    // Delay initial fetch to avoid cold start cascade on page load
    const timer = setTimeout(() => {
      fetchResumo();
    }, 8000); // 8s delay
    // Atualiza a cada 60 segundos
    const interval = setInterval(fetchResumo, 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [fetchResumo]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const meta = data?.meta || 2000;
  const valorAtual = data?.totalVendas || 0;
  const percentual = data?.percentual || 0;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
      {/* Título */}
      <div className="flex items-center gap-2 shrink-0">
        <Target className="h-4 w-4 text-[#14919B]" />
        <span className="text-sm font-semibold text-white/80">Performance Hoje</span>
      </div>

      {/* Barra de progresso compacta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 whitespace-nowrap">
            Meta: {formatCurrency(meta)}
          </span>
          <div className="flex-1">
            <Progress value={Math.min(percentual, 100)} className="h-2 bg-white/10" />
          </div>
          <span className="text-xs font-bold text-white whitespace-nowrap">
            {formatCurrency(valorAtual)}
          </span>
          <Badge
            variant={percentual >= 100 ? "default" : "secondary"}
            className={cn(
              "text-[10px] px-1.5 py-0",
              percentual >= 100 && "bg-emerald-600 hover:bg-emerald-600",
              percentual < 100 && "bg-white/10 text-white/60"
            )}
          >
            {percentual}%
          </Badge>
        </div>
      </div>
    </div>
  );
}