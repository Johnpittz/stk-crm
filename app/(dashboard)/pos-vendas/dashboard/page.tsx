import { PlaceholderPage } from "@/components/placeholder-page";
import { Headphones } from "lucide-react";

export default function PosVendasDashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard Pós-Vendas"
      subtitle="Visão geral do suporte e acompanhamento"
      icon={Headphones}
      features={[
        "Métricas de satisfação do cliente",
        "Tempo médio de resolução",
        "Chamados abertos vs resolvidos",
        "NPS e CSAT em tempo real"
      ]}
    />
  );
}