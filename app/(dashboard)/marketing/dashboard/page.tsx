import { PlaceholderPage } from "@/components/placeholder-page";
import { BarChart3 } from "lucide-react";

export default function MarketingDashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard Marketing"
      subtitle="Visão geral das métricas e campanhas"
      icon={BarChart3}
      features={[
        "Métricas de engajamento em tempo real",
        "Gráficos de conversão por campanha",
        "ROI por canal de comunicação",
        "Comparativo de performance entre períodos"
      ]}
    />
  );
}