/**
 * 06/10 — "Tem Usina Solar" (SIM/NÃO) → abre ESTE formulário automaticamente.
 * Grava na coluna `clientes.usina` como JSON no mesmo formato que a AXS
 * consome ({ CRI, usina }) + `potencia` (kWp).
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DadosUsina {
  cri: string;
  nome: string;
  potencia: string;
}

const VAZIO: DadosUsina = { cri: "", nome: "", potencia: "" };

export function parseUsina(valor: string | null | undefined): DadosUsina {
  if (!valor) return { ...VAZIO };
  try {
    const obj = JSON.parse(valor);
    return {
      cri: String(obj.CRI ?? obj.cri ?? ""),
      nome: String(obj.usina ?? obj.nome ?? ""),
      potencia: String(obj.potencia ?? ""),
    };
  } catch {
    return { ...VAZIO };
  }
}

export function serializarUsina(dados: DadosUsina): string {
  return JSON.stringify({ CRI: dados.cri, usina: dados.nome, potencia: dados.potencia });
}

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  valor: DadosUsina;
  onSalvar: (dados: DadosUsina) => void;
}

export function FormUsinaSolar({ open, onOpenChange, valor, onSalvar }: Props) {
  const [campos, setCampos] = useState<DadosUsina>(valor);
  const [erros, setErros] = useState<Record<string, string>>({});

  // Ao abrir, parte dos dados já gravados no cliente
  useEffect(() => {
    if (open) {
      setCampos(valor);
      setErros({});
    }
  }, [open, valor]);

  const salvar = () => {
    const novos: Record<string, string> = {};
    if (!campos.nome.trim()) novos.nome = "Informe o nome da usina";
    const pot = parseFloat(campos.potencia.replace(",", "."));
    if (campos.potencia.trim() === "" || Number.isNaN(pot) || pot <= 0) {
      novos.potencia = "Informe a potência em kWp";
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar({
      cri: campos.cri.trim(),
      nome: campos.nome.trim(),
      potencia: String(pot),
    });
  };

  const campo = (valor: string) => `bg-[#0f1d32] border-[#1c2e4a] text-white`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#14233c] border-[#1c2e4a] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Usina Solar</DialogTitle>
          <DialogDescription className="text-slate-400">
            Dados da usina do cliente — aparecem na proposta de geração distribuída.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-300">Nome da usina *</Label>
            <Input
              value={campos.nome}
              onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
              placeholder="Ex: Usina Solar CD Rede ABC"
              className={campo(campos.nome)}
            />
            {erros.nome && <p className="text-[11px] text-red-400">{erros.nome}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">Potência (kWp) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={campos.potencia}
                onChange={(e) => setCampos((c) => ({ ...c, potencia: e.target.value }))}
                placeholder="Ex: 75,5"
                className={campo(campos.potencia)}
              />
              {erros.potencia && (
                <p className="text-[11px] text-red-400">{erros.potencia}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-slate-300">CRI</Label>
              <Input
                value={campos.cri}
                onChange={(e) => setCampos((c) => ({ ...c, cri: e.target.value }))}
                placeholder="Código de registro"
                className={campo(campos.cri)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#1c2e4a] text-slate-400 hover:text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={salvar}
            className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
          >
            Salvar usina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
