"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface SimularWhatsAppModalProps {
  onSuccess?: () => void;
}

export function SimularWhatsAppModal({ onSuccess }: SimularWhatsAppModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("Oi, gostaria de um orcamento");
  const [nome, setNome] = useState("");

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefone || !mensagem) return;

    setLoading(true);
    setResultado(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResultado("ERRO: Nao autenticado");
        return;
      }

      const res = await fetch("/api/atendimentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          telefone_cliente: telefone.replace(/\D/g, ""),
          nome_cliente: nome || null,
          mensagem,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.updated) {
          setResultado("Atendimento existente atualizado com nova mensagem!");
        } else {
          setResultado(`Atendimento criado! ID: ${data.atendimento_id}`);
        }
        setTimeout(() => {
          setOpen(false);
          setResultado(null);
          setTelefone("");
          setNome("");
          onSuccess?.();
        }, 1500);
      } else {
        setResultado(`ERRO: ${data.error || "Falha ao criar"}`);
      }
    } catch (err: any) {
      setResultado(`ERRO: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-green-600 text-green-700 hover:bg-green-50">
          <MessageCircle className="h-3.5 w-3.5" />
          Simular WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simular Mensagem WhatsApp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone do cliente *</Label>
            <Input
              id="telefone"
              placeholder="Ex: 62981269368"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
            <p className="text-[10px] text-slate-400">
              Digite apenas numeros. O CRM vai buscar o cliente pelo telefone/celular.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome (opcional - para cliente novo)</Label>
            <Input
              id="nome"
              placeholder="Ex: Carlos Veiculos"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem *</Label>
            <textarea
              id="mensagem"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              required
            />
          </div>

          {resultado && (
            <div className={`text-xs p-2 rounded ${resultado.startsWith("ERRO") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {resultado}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !telefone} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simular Mensagem"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
