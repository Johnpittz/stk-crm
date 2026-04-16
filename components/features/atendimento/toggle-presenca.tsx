"use client";

import { useState } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { vendedorAtual } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

export function TogglePresenca() {
  const [ativo, setAtivo] = useState(vendedorAtual.online);

  return (
    <Card
      className={cn(
        "border-l-4 transition-colors",
        ativo ? "border-l-emerald-500" : "border-l-red-500"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                ativo ? "bg-emerald-100" : "bg-red-100"
              )}
            >
              {ativo ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-900">
                  {ativo ? "🟢 Ativo" : "🔴 Inativo"}
                </h3>
                <Badge
                  variant={ativo ? "default" : "destructive"}
                  className={cn(
                    ativo && "bg-emerald-600 hover:bg-emerald-600"
                  )}
                >
                  {ativo ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {ativo
                  ? "Recebendo atendimentos normalmente"
                  : "Mensagens sendo transbordadas"}
              </p>
            </div>
          </div>

          <Switch
            checked={ativo}
            onCheckedChange={setAtivo}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>

        {!ativo && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  Transbordo ativado
                </p>
                <p className="text-amber-700">
                  Suas mensagens de WhatsApp serão redirecionadas para: {" "}
                  <strong>João Silva (Gerente)</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {ativo && (
          <div className="mt-4 text-xs text-slate-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Inatividade por mais de 30 min ativa transbordo automático
          </div>
        )}
      </CardContent>
    </Card>
  );
}
