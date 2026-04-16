"use client";

import { Flame, Gift, Link2, TrendingUp, Phone, MessageCircle, X, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { alertasChurn, oportunidades } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

const iconesTipo = {
  churn: <Flame className="h-5 w-5 text-red-500" />,
  promocao: <Gift className="h-5 w-5 text-purple-500" />,
  afinidade: <Link2 className="h-5 w-5 text-blue-500" />,
  ciclo: <TrendingUp className="h-5 w-5 text-emerald-500" />,
};

const coresTipo = {
  churn: "border-l-red-500 bg-red-50",
  promocao: "border-l-purple-500 bg-purple-50",
  afinidade: "border-l-blue-500 bg-blue-50",
  ciclo: "border-l-emerald-500 bg-emerald-50",
};

export function MotorOportunidades() {
  const todasOportunidades = [
    ...alertasChurn.map((c) => ({
      id: c.id,
      tipo: "churn" as const,
      titulo: `🔥 Cliente sem compra há ${c.diasSemCompra} dias`,
      cliente: c.cliente,
      descricao: `Última compra: ${c.ultimaCompra}. Ticket médio: R$ ${c.ticketMedio.toLocaleString()}`,
      valorEstimado: c.ticketMedio,
      prioridade: c.prioridade,
    })),
    ...oportunidades,
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            🎯 Oportunidades
            <Badge className="bg-blue-600 text-xs">{todasOportunidades.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-slate-500">
            Ver Todas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-2">
            {todasOportunidades.map((opp) => (
              <div
                key={opp.id}
                className={cn(
                  "p-2.5 rounded-lg border-l-4 border shadow-sm bg-white",
                  coresTipo[opp.tipo as keyof typeof coresTipo]
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {iconesTipo[opp.tipo as keyof typeof iconesTipo]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-xs text-slate-900 truncate">
                        {opp.titulo}
                      </h4>
                      {opp.prioridade === "alta" && (
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-700 text-xs"
                        >
                          Alta
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs font-medium text-slate-700">
                      {opp.cliente}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                      {opp.descricao}
                    </p>

                    {opp.valorEstimado && (
                      <p className="text-[10px] font-medium text-emerald-600 mt-0.5">
                        Potencial: R$ {opp.valorEstimado.toLocaleString()}
                      </p>
                    )}

                    {/* Ações */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" className="h-7 text-xs gap-1">
                        <Phone className="h-3 w-3" />
                        Ligar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Whats
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-slate-500"
                      >
                        <Eye className="h-3 w-3" />
                        Ver
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 ml-auto text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
