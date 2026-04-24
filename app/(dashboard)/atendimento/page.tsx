"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { KanbanTarefas } from "@/components/features/atendimento/kanban-tarefas";
import { AgendaDia } from "@/components/features/atendimento/agenda-dia";
import { MotorOportunidades } from "@/components/features/atendimento/motor-oportunidades";
import { ListaAtendimentos } from "@/components/features/atendimento/lista-atendimentos";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { ClipboardList, Target, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AtendimentoPage() {
  const [abaAtiva, setAbaAtiva] = useState("trabalho");

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      
      {/* HEADER - Toggle + Performance (altura fixa) */}
      <div className="shrink-0 space-y-2">
        <TogglePresenca />
        <PerformanceRealTime />
      </div>

      {/* ABAS - Ocupa o espaço restante */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex-1 flex flex-col min-h-0 mt-2">
        <TabsList className="grid w-full grid-cols-3 h-9 shrink-0">
          <TabsTrigger value="trabalho" className="gap-1 text-xs">
            <ClipboardList className="h-3.5 w-3.5" />
            Meu Trabalho
          </TabsTrigger>
          <TabsTrigger value="oportunidades" className="gap-1 text-xs">
            <Target className="h-3.5 w-3.5" />
            Oportunidades
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            Atendimentos
          </TabsTrigger>
        </TabsList>

        {/* CONTEÚDO DAS ABAS - Altura limitada */}
        <div className="flex-1 min-h-0 mt-2 overflow-hidden">
          
          {/* ABA 1: MEU TRABALHO */}
          <TabsContent value="trabalho" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
              <div className="lg:col-span-2 h-full overflow-hidden">
                <KanbanTarefas />
              </div>
              <div className="h-full overflow-hidden">
                <AgendaDia />
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: OPORTUNIDADES */}
          <TabsContent value="oportunidades" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="h-full overflow-hidden">
              <MotorOportunidades />
            </div>
          </TabsContent>

          {/* ABA 3: ATENDIMENTOS WHATSAPP */}
          <TabsContent value="atendimentos" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="h-full overflow-hidden">
              <ListaAtendimentos />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
