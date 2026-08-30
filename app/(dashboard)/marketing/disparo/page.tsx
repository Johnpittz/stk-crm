import { PlaceholderPage } from "@/components/placeholder-page";
import { Send } from "lucide-react";

export default function MarketingDisparoPage() {
  return (
    <PlaceholderPage
      title="Disparo em Massa"
      subtitle="Envio de mensagens e campanhas automatizadas"
      icon={Send}
      features={[
        "Disparo via WhatsApp e E-mail",
        "Agendamento de envios",
        "Templates personalizáveis",
        "Controle de taxa de envio",
        "Relatórios de entrega e abertura"
      ]}
    />
  );
}