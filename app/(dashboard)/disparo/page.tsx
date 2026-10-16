"use client";

/**
 * ITEM 2 (16/10) — tela ÚNICA do Disparo (decisão do João: "um único menu
 * Disparo (sem Campanhas)"). Tudo junto, sem abas: criar disparo
 * (BulkSender + carga de arte da galeria), campanhas (com Novo Disparo,
 * massa e remarketing) e relatórios — empilhados na mesma tela.
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
          Tudo em um lugar: criar disparo, acompanhar as campanhas e ver os
          relatórios — sem trocar de tela.
        </p>
      </div>

      <section aria-labelledby="sec-criar">
        <h2 id="sec-criar" className="text-lg font-semibold text-white mb-3">
          Criar disparo
        </h2>
        <BulkSender />
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
