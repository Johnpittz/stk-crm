import { PlaceholderPage } from "@/components/placeholder-page";
import { Megaphone } from "lucide-react";

export default function MarketingCampanhasPage() {
  return (
    <PlaceholderPage
      title="Campanhas"
      subtitle="Criação e gestão de campanhas de marketing"
      icon={Megaphone}
      features={[
        "Criação de campanhas multi-canal",
        "Segmentação de público-alvo",
        "A/B Testing de mensagens",
        "Cronograma de execução",
        "Métricas de performance por campanha"
      ]}
    />
  );
}