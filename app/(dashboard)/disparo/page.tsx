"use client";

/**
 * ITEM 2 (16/10) — tela ÚNICA do Disparo (decisão do João: "um único menu
 * Disparo (sem Campanhas)"). 19/10: seção Campanhas de volta (o "Novo
 * Disparo" com MASSA-Excel e REMARKETING mora lá) — o BulkSender ganhou
 * botões que abrem aquele diálogo já na aba escolhida; painel de envios
 * fica no lugar da lista antiga; relatórios seguem aqui.
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

      <section aria-labelledby="sec-criar">
        <h2 id="sec-criar" className="text-lg font-semibold text-white mb-3">
          Criar disparo
        </h2>
        <BulkSender
          aoEscolherDisparo={(tipo) =>
            window.dispatchEvent(
              new CustomEvent<"massa" | "remarketing">("abrir-disparo-em-massa", {
                detail: tipo,
              })
            )
          }
        />
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
