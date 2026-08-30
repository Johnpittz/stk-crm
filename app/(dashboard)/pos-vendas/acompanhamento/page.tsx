import { PlaceholderPage } from "@/components/placeholder-page";
import { ClipboardList } from "lucide-react";

export default function PosVendasAcompanhamentoPage() {
  return (
    <PlaceholderPage
      title="Acompanhamento"
      subtitle="Monitoramento de pedidos e entregas"
      icon={ClipboardList}
      features={[
        "Status de pedidos em tempo real",
        "Rastreamento de entregas",
        "Notificações automáticas",
        "Gestão de devoluções",
        "Histórico de acompanhamento"
      ]}
    />
  );
}