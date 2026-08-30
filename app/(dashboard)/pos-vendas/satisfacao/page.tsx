import { PlaceholderPage } from "@/components/placeholder-page";
import { Star } from "lucide-react";

export default function PosVendasSatisfacaoPage() {
  return (
    <PlaceholderPage
      title="Satisfação"
      subtitle="Pesquisas e métricas de satisfação do cliente"
      icon={Star}
      features={[
        "Pesquisas NPS e CSAT",
        "Análise de sentimento",
        "Dashboard de satisfação",
        "Alertas de insatisfação",
        "Relatórios por período"
      ]}
    />
  );
}