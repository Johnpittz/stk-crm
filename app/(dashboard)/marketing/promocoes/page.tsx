import { PlaceholderPage } from "@/components/placeholder-page";
import { Tag } from "lucide-react";

export default function MarketingPromocoesPage() {
  return (
    <PlaceholderPage
      title="Promoções"
      subtitle="Gestão de promoções e ofertas especiais"
      icon={Tag}
      features={[
        "Criação de promoções",
        "Cupons de desconto",
        "Ofertas personalizadas",
        "Controle de validade",
        "Integração com catálogo de produtos"
      ]}
    />
  );
}