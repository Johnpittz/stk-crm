"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface DadosConta {
  uc?: string;
  consumo_kwh?: number;
  vencimento?: string;
  valor_total?: number;
  bandeira?: string;
  numero_conta?: string;
}

interface AlertaContaDetectadaProps {
  atendimentoId: string;
  clienteId?: string;
  clienteNome?: string;
  dados: DadosConta;
  confianca: number;
  mensagemId?: string;
  onDismiss: () => void;
  onOportunidadeCriada?: () => void;
}

export function AlertaContaDetectada({
  atendimentoId,
  clienteId,
  clienteNome,
  dados,
  confianca,
  mensagemId,
  onDismiss,
  onOportunidadeCriada,
}: AlertaContaDetectadaProps) {
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const supabase = createClient();

  const handleCriarOportunidade = async () => {
    setCriando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Criar oportunidade
      const res = await fetch("/api/oportunidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          titulo: `Conta de energia - ${clienteNome || "Cliente"}`,
          tipo: "gd",
          cliente_id: clienteId || null,
          atendimento_id: atendimentoId,
          cliente_nome: clienteNome || null,
          uc: dados.uc || null,
          consumo_kwh: dados.consumo_kwh || null,
          descricao: dados.valor_total
            ? `Valor: R$ ${dados.valor_total.toLocaleString("pt-BR")}`
            : null,
        }),
      });

      if (res.ok) {
        // Marcar alerta como aceito
        await fetch("/api/atendimentos/alertas", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            atendimento_id: atendimentoId,
            mensagem_id: mensagemId,
            status: "aceito",
          }),
        });

        setCriado(true);
        setTimeout(() => {
          onOportunidadeCriada?.();
          onDismiss();
        }, 1500);
      }
    } catch (err) {
      console.error("Erro ao criar oportunidade:", err);
    } finally {
      setCriando(false);
    }
  };

  if (criado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        <span className="text-xs text-green-300 font-medium">
          Oportunidade criada com sucesso!
        </span>
      </div>
    );
  }

  return (
    <div className="border border-[#3B64CF]/30 bg-[#3B64CF]/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#3B64CF]" />
          <span className="text-xs font-medium text-white">
            Possível conta de energia detectada
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] px-1.5 py-0",
              confianca >= 0.7
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            )}
          >
            {Math.round(confianca * 100)}% certeza
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-slate-500 hover:text-white"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Dados detectados */}
      {Object.keys(dados).length > 0 && (
        <div className="px-3 pb-2">
          <button
            className="text-[10px] text-slate-400 hover:text-white transition-colors"
            onClick={() => setExpandido(!expandido)}
          >
            {expandido ? "Ocultar dados" : "Ver dados detectados"}
          </button>
          
          {expandido && (
            <div className="mt-2 flex flex-wrap gap-2">
              {dados.uc && (
                <Badge variant="secondary" className="text-[9px] bg-slate-700 text-slate-300">
                  UC: {dados.uc}
                </Badge>
              )}
              {dados.consumo_kwh && (
                <Badge variant="secondary" className="text-[9px] bg-slate-700 text-slate-300">
                  {dados.consumo_kwh} kWh
                </Badge>
              )}
              {dados.valor_total && (
                <Badge variant="secondary" className="text-[9px] bg-slate-700 text-slate-300">
                  R$ {dados.valor_total.toLocaleString("pt-BR")}
                </Badge>
              )}
              {dados.vencimento && (
                <Badge variant="secondary" className="text-[9px] bg-slate-700 text-slate-300">
                  Vence: {dados.vencimento}
                </Badge>
              )}
              {dados.bandeira && (
                <Badge variant="secondary" className="text-[9px] bg-slate-700 text-slate-300">
                  Bandeira {dados.bandeira}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="px-3 pb-2 flex gap-2">
        <Button
          size="sm"
          className="h-7 text-[11px] bg-[#3B64CF] hover:bg-[#2d4fa8] text-white"
          onClick={handleCriarOportunidade}
          disabled={criando}
        >
          {criando ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <FileText className="h-3 w-3 mr-1" />
          )}
          Criar Oportunidade
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-slate-400 hover:text-white"
          onClick={onDismiss}
        >
          Dispensar
        </Button>
      </div>
    </div>
  );
}
