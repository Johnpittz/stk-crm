"use client";

/**
 * ITEM 2 (16/10) — tela ÚNICA do Disparo (decisão do João: "um único menu
 * Disparo (sem Campanhas)"). 19/10: seção Campanhas de volta (o "Novo
 * Disparo" com MASSA-Excel e REMARKETING mora lá) — o BulkSender ganhou
 * botões que abrem aquele diálogo já na aba escolhida; painel de envios
 * fica no lugar da lista antiga; relatórios seguem aqui.
 * 02/11 (pedido do João): form inline removido — criação SÓ pelo botão
 * "Novo Disparo" (antes "Nova Campanha"); a tela mostra só o painel.
 */
import { BulkSender } from "@/components/features/disparo/bulk-sender";
import CampanhasConteudo from "../marketing/campanhas/page";
import RelatoriosConteudo from "../marketing/relatorios/page";

export default function DisparoPage() {
  return (
    <div className="space-y-10 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white">Disparo</h1>
        <p className="text-white/50 text-sm mt-1">
          Crie disparos e acompanhe os envios no painel ao lado — sem trocar
          de tela.
        </p>
      </div>

      {/* 02/11 (pedido do João): o formulário "Criar disparo" saiu daqui —
          a criação acontece só no botão "Novo Disparo" (seção Campanhas,
          mais abaixo). Esta seção fica só com o Painel de Envios. */}
      <section aria-label="Painel de Envios">
        <BulkSender apenasPainel />
      </section>

      <section aria-labelledby="sec-campanhas">
        <h2 id="sec-campanhas" className="text-lg font-semibold text-white mb-3">
          Campanhas
        </h2>
        <CampanhasConteudo />
      </section>

      <section aria-labelledby="sec-relatorios">
        <h2 id="sec-relatorios" className="text-lg font-semibold text-white mb-3">
          Relatórios
        </h2>
        <RelatoriosConteudo />
      </section>
    </div>
  );
}
