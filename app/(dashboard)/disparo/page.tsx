"use client";

/**
 * REORGANIZAÇÃO DO DISPARO (25/11/2026) — proposta "Reorganização do
 * Aplicativo: arquitetura da informação, fluxo operacional e diretrizes
 * de interface para desenvolvimento".
 *
 * ANTES: uma página só, comprida, com 3 seções empilhadas (Painel de Envios,
 * Disparos e Relatórios) — o operador rolava a tela para achar cada bloco.
 *
 * AGORA: as seções viram NAVEGAÇÃO em abas, na ordem do documento:
 *   1. Visão Geral   → indicadores + painel de envios (BulkSender)
 *   2. Disparos      → histórico + botão "Novo Disparo" (CampanhasConteudo)
 *   3. Relatórios    → RelatoriosConteudo
 *   4. Configurações → sessões WhatsApp pareadas (novo)
 *
 * Fora do escopo desta rodada (próximas fases da proposta): Contatos e
 * Listas, Modelos de Mensagens, estados Agendado/Validando/Cancelado e os
 * indicadores Entregues/Visualizados (dependem de migration) — detalhes em
 * docs/plano-reorganizacao-disparo.md.
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Inbox, History, Settings } from "lucide-react";
import { BulkSender } from "@/components/features/disparo/bulk-sender";
import CampanhasConteudo from "../marketing/campanhas/page";
import RelatoriosConteudo from "../marketing/relatorios/page";
import { ConfiguracoesDisparo } from "@/components/features/disparo/configuracoes-disparo";

export default function DisparoPage() {
  // Seção aberta. `visao-geral` é a inicial: é a que o operador olha todo dia.
  const [aba, setAba] = useState<string>("visao-geral");

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white">Disparo</h1>
        <p className="text-white/50 text-sm mt-1">
          Crie disparos e acompanhe os envios — cada bloco na sua aba, sem
          rolar a página.
        </p>
      </div>

      <Tabs value={aba} onValueChange={setAba} className="w-full">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="visao-geral" className="gap-1.5">
            <BarChart3 size={14} />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="disparos" className="gap-1.5">
            <Inbox size={14} />
            Disparos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5">
            <History size={14} />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5">
            <Settings size={14} />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* 1. Visão Geral — só o Painel de Envios (form removido em 02/11). */}
        <TabsContent value="visao-geral" className="mt-6">
          <section aria-label="Painel de Envios">
            <BulkSender apenasPainel />
          </section>
        </TabsContent>

        {/* 2. Disparos — histórico + diálogo "Novo Disparo" (avulso/massa/
            remarketing). É o mesmo componente que morava na rota
            /marketing/campanhas. */}
        <TabsContent value="disparos" className="mt-6">
          <section aria-labelledby="sec-campanhas">
            <h2 id="sec-campanhas" className="text-lg font-semibold text-white mb-3">
              Disparos
            </h2>
            <CampanhasConteudo />
          </section>
        </TabsContent>

        {/* 3. Relatórios — mesmo conteúdo da rota /marketing/relatorios. */}
        <TabsContent value="relatorios" className="mt-6">
          <section aria-labelledby="sec-relatorios">
            <h2 id="sec-relatorios" className="text-lg font-semibold text-white mb-3">
              Relatórios
            </h2>
            <RelatoriosConteudo />
          </section>
        </TabsContent>

        {/* 4. Configurações — sessões WhatsApp (Fase 1 da proposta). */}
        <TabsContent value="configuracoes" className="mt-6">
          <ConfiguracoesDisparo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
