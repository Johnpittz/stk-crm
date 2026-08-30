import { PlaceholderPage } from "@/components/placeholder-page";
import { LifeBuoy } from "lucide-react";

export default function PosVendasSuportePage() {
  return (
    <PlaceholderPage
      title="Suporte"
      subtitle="Atendimento e resolução de problemas"
      icon={LifeBuoy}
      features={[
        "Chamados de suporte técnico",
        "Base de conhecimento",
        "Chatbot com IA",
        "Escalação automática",
        "SLA e tempo de resposta"
      ]}
    />
  );
}