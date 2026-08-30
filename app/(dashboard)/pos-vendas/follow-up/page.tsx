import { PlaceholderPage } from "@/components/placeholder-page";
import { CalendarCheck } from "lucide-react";

export default function PosVendasFollowUpPage() {
  return (
    <PlaceholderPage
      title="Follow-up"
      subtitle="Acompanhamento pós-venda automatizado"
      icon={CalendarCheck}
      features={[
        "Follow-up automático após compra",
        "Lembretes de garantia",
        "Pesquisas de satisfação",
        "Upsell e cross-sell inteligente",
        "Agendamento de contato"
      ]}
    />
  );
}