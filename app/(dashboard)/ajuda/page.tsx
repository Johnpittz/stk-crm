"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Headset,
  ClipboardList,
  Target,
  Users,
  Package,
  LayoutDashboard,
  Settings,
  Briefcase,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { ConteudoAtendimento } from "@/components/features/ajuda/conteudo-atendimento";
import { ConteudoKanban } from "@/components/features/ajuda/conteudo-kanban";
import { ConteudoLeads } from "@/components/features/ajuda/conteudo-leads";
import { ConteudoClientes } from "@/components/features/ajuda/conteudo-clientes";
import { ConteudoProdutos } from "@/components/features/ajuda/conteudo-produtos";
import { ConteudoDashboard } from "@/components/features/ajuda/conteudo-dashboard";
import { ConteudoConfig } from "@/components/features/ajuda/conteudo-config";
import { ConteudoEquipes } from "@/components/features/ajuda/conteudo-equipes";

export default function AjudaPage() {
  const [abaAtiva, setAbaAtiva] = useState("atendimento");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[#0D3B33] flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Ajuda</h1>
          <p className="text-slate-500 text-sm">
            Aprenda a usar o CRM-ROMA — navegue pelas abas para entender cada funcionalidade.
          </p>
        </div>
      </div>

      {/* Abas */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto gap-1 bg-slate-100 p-1">
          <TabsTrigger
            value="atendimento"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Headset className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atendimento</span>
          </TabsTrigger>
          <TabsTrigger
            value="kanban"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kanban</span>
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger
            value="produtos"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger
            value="dashboard"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger
            value="equipes"
            className="gap-1.5 text-xs py-2 data-[state=active]:bg-[#0D3B33] data-[state=active]:text-white"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Equipes</span>
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo das abas */}
        <div className="mt-6">
          <TabsContent value="atendimento" className="mt-0">
            <ConteudoAtendimento />
          </TabsContent>
          <TabsContent value="kanban" className="mt-0">
            <ConteudoKanban />
          </TabsContent>
          <TabsContent value="leads" className="mt-0">
            <ConteudoLeads />
          </TabsContent>
          <TabsContent value="clientes" className="mt-0">
            <ConteudoClientes />
          </TabsContent>
          <TabsContent value="produtos" className="mt-0">
            <ConteudoProdutos />
          </TabsContent>
          <TabsContent value="dashboard" className="mt-0">
            <ConteudoDashboard />
          </TabsContent>
          <TabsContent value="config" className="mt-0">
            <ConteudoConfig />
          </TabsContent>
          <TabsContent value="equipes" className="mt-0">
            <ConteudoEquipes />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}