"use client";

import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { metas } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

export function PerformanceRealTime() {
  const metaAtual = metas["diaria"];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-white border border-slate-200 rounded-lg">
      {/* Título */}
      <div className="flex items-center gap-2 shrink-0">
        <Target className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-slate-700">Performance Hoje</span>
      </div>

      {/* Barra de progresso compacta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Meta: {formatCurrency(metaAtual.valorMeta)}
          </span>
          <div className="flex-1">
            <Progress value={metaAtual.percentual} className="h-2" />
          </div>
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            {formatCurrency(metaAtual.valorAtual)}
          </span>
          <Badge
            variant={metaAtual.percentual >= 100 ? "default" : "secondary"}
            className={cn(
              "text-[10px] px-1.5 py-0",
              metaAtual.percentual >= 100 && "bg-emerald-600 hover:bg-emerald-600"
            )}
          >
            {metaAtual.percentual}%
          </Badge>
        </div>
      </div>
    </div>
  );
}
