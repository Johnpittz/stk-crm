"use client";

import { Check, MapPin, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agendaDia, iconesTarefa } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

export function AgendaDia() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          📅 Agenda do Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-2 relative">
            {/* Linha do tempo */}
            <div className="absolute left-[52px] top-4 bottom-4 w-px bg-slate-200" />

            {agendaDia.map((item, index) => (
              <div key={item.id} className="flex gap-4 relative">
                {/* Hora */}
                <div className="w-12 text-right">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      item.concluido ? "text-slate-400" : "text-slate-700"
                    )}
                  >
                    {item.hora}
                  </span>
                </div>

                {/* Marcador */}
                <div
                  className={cn(
                    "relative z-10 w-3 h-3 rounded-full mt-1.5 border-2",
                    item.concluido
                      ? "bg-emerald-500 border-emerald-500"
                      : item.status === "em_andamento"
                      ? "bg-blue-500 border-blue-500 animate-pulse"
                      : "bg-white border-slate-300"
                  )}
                />

                {/* Conteúdo */}
                <div
                  className={cn(
                    "flex-1 pb-4",
                    item.concluido && "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "p-3 rounded-lg border",
                      item.concluido
                        ? "bg-slate-50 border-slate-200"
                        : item.status === "em_andamento"
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {iconesTarefa[item.tipo as keyof typeof iconesTarefa]}
                          </span>
                          <span
                            className={cn(
                              "font-medium text-sm",
                              item.concluido
                                ? "text-slate-500 line-through"
                                : "text-slate-900"
                            )}
                          >
                            {item.titulo}
                          </span>
                          {item.status === "em_andamento" && (
                            <Badge
                              variant="secondary"
                              className="bg-blue-100 text-blue-700 text-xs"
                            >
                              Agora
                            </Badge>
                          )}
                        </div>

                        {item.endereco && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                            <MapPin className="h-3 w-3" />
                            {item.endereco}
                          </p>
                        )}

                        {/* Ações */}
                        <div className="flex items-center gap-2 mt-2">
                          {!item.concluido && (
                            <>
                              {item.tipo === "visita" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                >
                                  <MapPin className="h-3 w-3" />
                                  Check-in
                                </Button>
                              )}
                              {(item.tipo === "ligacao" ||
                                item.tipo === "whatsapp") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                  >
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
                                </>
                              )}
                            </>
                          )}

                          {item.concluido && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-700 text-xs"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Concluído
                            </Badge>
                          )}
                        </div>
                      </div>

                      {!item.concluido && item.status !== "em_andamento" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-emerald-600"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
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
