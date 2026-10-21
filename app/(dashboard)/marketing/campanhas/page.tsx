'use client';

import { CampanhasConteudo } from '@/components/features/campanhas/campanhas-conteudo';

/**
 * Rota /marketing/campanhas — casca fina (Next não aceita props nem named
 * exports em page). O conteúdo (histórico + diálogo "Novo Disparo") mora
 * em components/features/campanhas/campanhas-conteudo.tsx, que também é
 * usado embutido na tela de Disparo (props exibirSomenteCriar).
 */
export default function CampanhasPage() {
  return <CampanhasConteudo />;
}
