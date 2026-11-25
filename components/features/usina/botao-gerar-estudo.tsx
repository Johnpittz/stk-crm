"use client";
/**
 * 25/11/2026 — Fase2-B: gatilho da IA da FATURA → ESTUDO de usina.
 *
 * Quando a análise da conta identifica/sugere "usina própria", o modal
 * mostrava só o rótulo "avaliar". Este botão leva direto para a aba
 * "Estudo Usina" da pasta do cliente, com tudo pronto para dimensionar.
 * (Componente separado do modal para ser testável sem montar o fluxo
 * inteiro de análise de fatura.)
 */
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  clienteId: string;
  onClose: () => void;
}

export function BotaoGerarEstudo({ clienteId, onClose }: Props) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      className="mt-2 h-7 bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
      onClick={() => {
        onClose();
        router.push(`/clientes/${clienteId}?aba=estudo_usina`);
      }}
    >
      📐 Gerar estudo de usina →
    </Button>
  );
}
