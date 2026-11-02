"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OPÇÕES_ORIGEM,
  validarOrigem,
  montarCamposOrigem,
} from "@/lib/clientes/origem-cliente";

export function ModalNovoCliente() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // PARTE 11 — origem (tipo → subtipo → vendedor/parceiro)
  const [origemTipo, setOrigemTipo] = useState("");
  const [origemSubtipo, setOrigemSubtipo] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [parceiroNome, setParceiroNome] = useState("");
  const [vendedores, setVendedores] = useState<Array<{ id: string; nome_completo: string }>>([]);
  const router = useRouter();
  const supabase = createClient();

  // lista de vendedores pro vínculo (mesmo /api/vendedores do cadastro completo)
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/vendedores");
        const json = await res.json().catch(() => ({}));
        if (vivo && res.ok) setVendedores(json.vendedores || []);
      } catch {
        // silencioso — select fica vazio
      }
    })();
    return () => {
      vivo = false;
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // PARTE 11 — origem precisa de subtipo (+ vendedor ou nome do parceiro)
    const errosOrigem = validarOrigem({
      origem_tipo: origemTipo || undefined,
      origem_subtipo: origemSubtipo || undefined,
      vendedor_responsavel_id: vendedorId || undefined,
      origem_indicacao_nome: parceiroNome || undefined,
    });
    if (errosOrigem.length) {
      setError(errosOrigem[0]);
      setLoading(false);
      return;
    }

    const body = {
      nome_razao_social: formData.get("nome_razao_social") as string,
      cpf_cnpj: formData.get("cpf_cnpj") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string,
      cidade: formData.get("cidade") as string,
      estado: formData.get("estado") as string,
      status: formData.get("status") as string,
      tipo: formData.get("tipo") as string,
      // grava origem + vendedor vinculado (mesmos campos do cadastro completo)
      ...montarCamposOrigem({
        origem_tipo: origemTipo,
        origem_subtipo: origemSubtipo,
        vendedor_responsavel_id: vendedorId,
        origem_indicacao_nome: parceiroNome,
      }),
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(result.error || "Erro ao salvar cliente.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente para cadastrá-lo no sistema.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_razao_social">Nome / Razão Social *</Label>
              <Input id="nome_razao_social" name="nome_razao_social" placeholder="Ex: Rede ABC Ltda" required />
            </div>

            {/* ═══════ ORIGEM (vendedor/parceiro/marketing) — PARTE 11 ═══════ */}
            <div className="space-y-3 rounded-md border border-slate-200 p-3">
              <Label className="text-slate-600">Origem (opcional)</Label>
              <div className="flex flex-wrap gap-4">
                {Object.keys(OPÇÕES_ORIGEM).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="origem_tipo"
                      checked={origemTipo === t}
                      onChange={() => {
                        setOrigemTipo(t);
                        setOrigemSubtipo("");
                        setVendedorId("");
                        setParceiroNome("");
                      }}
                      className="accent-[#3B64CF]"
                    />
                    {OPÇÕES_ORIGEM[t].rotulo}
                  </label>
                ))}
              </div>
              {origemTipo && (
                <div className="flex flex-wrap gap-4">
                  {OPÇÕES_ORIGEM[origemTipo].subtipos.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer">
                      <input
                        type="radio"
                        name="origem_subtipo"
                        checked={origemSubtipo === s}
                        onChange={() => setOrigemSubtipo(s)}
                        className="accent-[#3B64CF]"
                      />
                      {OPÇÕES_ORIGEM[origemTipo].sub_rotulos[s] || s}
                    </label>
                  ))}
                </div>
              )}
              {origemTipo === "vendedor" && origemSubtipo && (
                <Select value={vendedorId} onValueChange={setVendedorId}>
                  <SelectTrigger className="h-10 w-full max-w-xs">
                    <SelectValue placeholder="Escolha o vendedor (vincula o cliente)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {origemTipo === "parceiro" && origemSubtipo && (
                <Input
                  value={parceiroNome}
                  onChange={(e) => setParceiroNome(e.target.value)}
                  placeholder="Nome do parceiro"
                  className="max-w-xs"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <select
                  id="tipo"
                  name="tipo"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="pj">Pessoa Jurídica</option>
                  <option value="pf">Pessoa Física</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select
                  id="status"
                  name="status"
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="ativo">Ativo</option>
                  <option value="prospect">Prospect</option>
                  <option value="churn">Churn</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CNPJ / CPF</Label>
              <Input id="cpf_cnpj" name="cpf_cnpj" placeholder="00.000.000/0000-00" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="email@empresa.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" placeholder="São Paulo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" name="estado" placeholder="SP" maxLength={2} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
