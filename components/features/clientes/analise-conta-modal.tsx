"use client";

/**
 * PARTE 11 (PPTX 17/10) — "Análise da conta": sobe a foto/PDF da fatura,
 * a IA lê e o resumo entra na pasta do cliente.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  clienteId: string;
  onClose: () => void;
}

interface Resumo {
  concessionaria: string | null;
  uc: string | null;
  titular: string | null;
  cnpj_cpf: string | null;
  vencimento: string | null;
  consumo: string | null;
  valor: string | null;
}

export function AnaliseContaModal({ clienteId, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function analisar() {
    if (!arquivo) {
      setErro("Escolha a foto ou o PDF da conta primeiro.");
      return;
    }
    setAnalisando(true);
    setErro(null);
    try {
      const { data: { session } } = await (
        await import("@/lib/supabase/client")
      ).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const auth = ["Bearer", token].join(" ");
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const res = await fetch(`/api/clientes/${clienteId}/analise-conta`, {
        method: "POST",
        headers: { Authorization: auth },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na análise.");
      setResumo(json.resumo);
      setSalvo(!!json.salvo);
    } catch (e: any) {
      setErro(e.message || "Erro inesperado.");
    } finally {
      setAnalisando(false);
    }
  }

  const linha = (rotulo: string, valor: string | null) => (
    <div className="flex justify-between text-sm border-b border-white/5 py-1">
      <span className="text-slate-400">{rotulo}</span>
      <span className="text-white">{valor || "—"}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0f1d32] border-[#1c2e4a] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>🔍 Análise da conta</DialogTitle>
        </DialogHeader>

        {!resumo && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Envie uma foto/print ou o PDF da conta de energia — a IA lê e
              preenche os dados na pasta do cliente.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              {arquivo ? `📄 ${arquivo.name}` : "📎 Escolher conta"}
            </Button>
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <Button onClick={analisar} disabled={analisando} className="w-full">
              {analisando ? "Analisando com a IA..." : "🔍 Analisar conta"}
            </Button>
          </div>
        )}

        {resumo && (
          <div className="space-y-3">
            {linha("Concessionária", resumo.concessionaria)}
            {linha("UC", resumo.uc)}
            {linha("Titular", resumo.titular)}
            {linha("CNPJ/CPF", resumo.cnpj_cpf)}
            {linha("Vencimento (dia)", resumo.vencimento)}
            {linha("Consumo (kWh)", resumo.consumo)}
            {linha("Valor", resumo.valor)}
            {salvo && (
              <p className="text-xs text-emerald-400">
                ✅ Concessionária, UC e vencimento salvos na pasta do cliente.
              </p>
            )}
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
