import { PlaceholderPage } from "@/components/placeholder-page";
import { FileText } from "lucide-react";

export default function MarketingRelatoriosPage() {
  return (
    <PlaceholderPage
      title="Relatórios"
      subtitle="Análises e relatórios de marketing"
      icon={FileText}
      features={[
        "Relatórios de conversão",
        "Análise de ROI por campanha",
        "Métricas de engajamento",
        "Exportação em PDF/Excel",
        "Dashboards personalizáveis"
      ]}
    />
  );
}