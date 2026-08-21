"use client";

import { useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { vendedorAtual } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

export function TogglePresenca() {
  const [ativo, setAtivo] = useState(vendedorAtual.online);

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg shrink-0">
      {ativo ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-red-400" />
      )}
      <span className={cn("text-xs font-semibold", ativo ? "text-emerald-400" : "text-red-400")}>
        {ativo ? "Ativo" : "Inativo"}
      </span>
      <Badge
        variant={ativo ? "default" : "destructive"}
        className={cn("text-[9px] px-1.5 py-0 h-4", ativo ? "bg-emerald-600 hover:bg-emerald-600" : "bg-red-600 hover:bg-red-600")}
      >
        {ativo ? "Online" : "Offline"}
      </Badge>
      <Switch
        checked={ativo}
        onCheckedChange={setAtivo}
        className="data-[state=checked]:bg-emerald-600 scale-75"
      />
    </div>
  );
}
