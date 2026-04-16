"use client";

import { Trophy, Target, TrendingUp, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { campanhas } from "@/lib/data/mock";

export function PainelIncentivos() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" />
          Campanhas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-3">
            {campanhas.map((campanha) => (
              <div
                key={campanha.id}
                className="p-3 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{campanha.imagem}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-slate-900">
                      {campanha.titulo}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {campanha.descricao}
                    </p>

                    {/* Progresso */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-slate-600">Progresso</span>
                        <span className="font-medium text-slate-900">
                          {campanha.progresso}%
                        </span>
                      </div>
                      <Progress value={campanha.progresso} className="h-1.5" />
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>
                          {campanha.valorAtual
                            ? `R$ ${campanha.valorAtual.toLocaleString()}`
                            : `${campanha.atual} concluído`}
                        </span>
                        <span>
                          {campanha.valorMeta
                            ? `Meta: R$ ${campanha.valorMeta.toLocaleString()}`
                            : `Meta: ${campanha.meta}`}
                        </span>
                      </div>
                    </div>

                    {/* Ranking */}
                    {campanha.ranking && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700 text-xs"
                        >
                          <Trophy className="h-3 w-3 mr-1" />
                          {campanha.ranking}º lugar
                        </Badge>
                        <span className="text-xs text-slate-500">
                          no ranking geral
                        </span>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                      >
                        <Target className="h-3 w-3" />
                        Ver Detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-slate-500"
                      >
                        <Share2 className="h-3 w-3" />
                        Compartilhar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Dica */}
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <span className="text-xs text-blue-800">
                  <strong>Dica:</strong> Foque em clientes inativos para subir no
                  ranking!
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
