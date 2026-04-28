"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { KanbanTarefas } from "@/components/features/atendimento/kanban-tarefas";
import { AgendaDia } from "@/components/features/atendimento/agenda-dia";
import { MotorOportunidades } from "@/components/features/atendimento/motor-oportunidades";
import { ListaAtendimentos } from "@/components/features/atendimento/lista-atendimentos";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { ClipboardList, Target, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  assunto: string;
  ultima_mensagem: string;
  ultima_mensagem_data: string;
  status: string;
  transbordado: boolean;
  nao_lido: boolean;
  ultima_mensagem_remetente: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

export default function AtendimentoPage() {
  const [abaAtiva, setAbaAtiva] = useState("trabalho");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const supabase = createClient();

  const fetchAtendimentos = useCallback(async () => {
    setLoadingAtendimentos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setAtendimentos(data.atendimentos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAtendimentos(false);
    }
  }, [supabase]);

  // Busca atendimentos ao carregar a página (para contador de não lidos)
  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  const naoLidosCount = atendimentos.filter((a) => a.nao_lido).length;

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
          <TabsTrigger value="atendimentos" className="gap-1 text-xs relative">
            <MessageCircle className="h-3.5 w-3.5" />
            Atendimentos
            {naoLidosCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {naoLidosCount}
              </span>
            )}
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
              <ListaAtendimentos 
                atendimentos={atendimentos} 
                loading={loadingAtendimentos}
                onRefresh={fetchAtendimentos}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
