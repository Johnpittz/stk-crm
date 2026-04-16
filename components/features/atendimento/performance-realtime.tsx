"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Target, Zap, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { metas, projecaoMensal } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

export function PerformanceRealTime() {
  const [periodo, setPeriodo] = useState<"diaria" | "semanal" | "mensal">("mensal");

  const metaAtual = metas[periodo];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <Card className="border-l-4 border-l-blue-600 shrink-0">
      <CardHeader className="pb-1 py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-blue-600" />
            Performance em Tempo Real
          </CardTitle>
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <TabsList className="h-7">
              <TabsTrigger value="diaria" className="text-[10px] px-2 py-1">
                Diária
              </TabsTrigger>
              <TabsTrigger value="semanal" className="text-[10px] px-2 py-1">
                Semanal
              </TabsTrigger>
              <TabsTrigger value="mensal" className="text-[10px] px-2 py-1">
                Mensal
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 py-2">
        {/* Meta Principal */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Meta {periodo === "diaria" ? "do Dia" : periodo === "semanal" ? "da Semana" : "do Mês"}
            </span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(metaAtual.valorMeta)}
            </span>
          </div>
          <Progress value={metaAtual.percentual} className="h-2.5" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Alcançado</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {formatCurrency(metaAtual.valorAtual)}
              </span>
              <Badge
                variant={metaAtual.percentual >= 100 ? "default" : "secondary"}
                className={cn(
                  metaAtual.percentual >= 100 && "bg-emerald-600 hover:bg-emerald-600"
                )}
              >
                {metaAtual.percentual}%
              </Badge>
            </div>
          </div>
        </div>

        {/* Projeção (só aparece no mensal) */}
        {periodo === "mensal" && (
          <div className="rounded-lg bg-slate-50 p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Projeção para o fim do mês
              </span>
              <Badge
                variant="outline"
                className={cn(
                  projecaoMensal.tendencia === "acima"
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "border-red-600 text-red-700 bg-red-50"
                )}
              >
                {projecaoMensal.tendencia === "acima" ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {projecaoMensal.percentualProjecao}% da meta
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(projecaoMensal.valorProjecao)}
                </p>
                <p className="text-[10px] text-slate-500">Projeção</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xl font-bold",
                    projecaoMensal.gap <= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {projecaoMensal.gap <= 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(projecaoMensal.gap))}
                </p>
                <p className="text-[10px] text-slate-500">
                  {projecaoMensal.gap <= 0 ? "Acima" : "Abaixo"} da meta
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-blue-600">
                  {projecaoMensal.diasUteisRestantes}
                </p>
                <p className="text-[10px] text-slate-500">Dias úteis restantes</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-xs">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-slate-700">
                <strong>Velocidade necessária:</strong> Venda{" "}
                {formatCurrency(projecaoMensal.velocidadeNecessaria)}/dia para
                atingir a meta
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
