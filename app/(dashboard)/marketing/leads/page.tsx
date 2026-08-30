import { PlaceholderPage } from "@/components/placeholder-page";
import { Users } from "lucide-react";

export default function MarketingLeadsPage() {
  return (
    <PlaceholderPage
      title="Leads"
      subtitle="Gestão e qualificação de leads"
      icon={Users}
      features={[
        "Captura de leads de múltiplas fontes",
        "Qualificação automática (lead scoring)",
        "Distribuição para vendedores",
        "Histórico de interações",
        "Pipeline de nutrição"
      ]}
    />
  );
}