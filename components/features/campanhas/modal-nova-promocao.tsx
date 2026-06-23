"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Tag, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Produto {
  id: string;
  nome: string;
  codigo_erp: string | null;
  preco_venda: number | null;
  marca: string | null;
  categoria_nome: string | null;
}

interface ModalNovaPromocaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const tiposPromocao = [
  { value: "desconto_percentual", label: "Desconto %", icon: "%" },
  { value: "desconto_fixo", label: "Desconto R$", icon: "R$" },
  { value: "brinde", label: "Brinde", icon: "🎁" },
  { value: "cashback", label: "Cashback", icon: "💰" },
];

export function ModalNovaPromocao({
  open,
  onOpenChange,
  onCreated,
}: ModalNovaPromocaoProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [tipoPromocao, setTipoPromocao] = useState("desconto_percentual");
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Busca de produtos
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);

  useEffect(() => {
    if (!open) {
      setTitulo("");
      setDescricao("");
      setProdutoId("");
      setTipoPromocao("desconto_percentual");
      setValor("");
      setDataInicio("");
      setDataFim("");
      setError("");
      setBuscaProduto("");
      setProdutos([]);
      setProdutoSelecionado(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || buscaProduto.length < 2) {
      setProdutos([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingProdutos(true);
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session) return;

        const res = await fetch(
          `/api/produtos?busca=${encodeURIComponent(buscaProduto)}&limite=20`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const data = await res.json();
        if (res.ok) {
          setProdutos(data.produtos || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProdutos(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [buscaProduto, open]);

  const handleSelectProduto = (produto: Produto) => {
    setProdutoId(produto.id);
    setProdutoSelecionado(produto);
    setBuscaProduto("");
    setProdutos([]);
  };

  const handleSubmit = async () => {
    setError("");

    if (!titulo.trim()) {
      setError("Título é obrigatório");
      return;
    }
    if (!produtoId) {
      setError("Selecione um produto");
      return;
    }
    if (!dataFim) {
      setError("Data de fim é obrigatória");
      return;
    }
    if (
      (tipoPromocao === "desconto_percentual" || tipoPromocao === "desconto_fixo") &&
      (!valor || parseFloat(valor) <= 0)
    ) {
      setError("Informe o valor do desconto");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return;

      const res = await fetch("/api/promocoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          produto_id: produtoId,
          tipo_promocao: tipoPromocao,
          valor: valor ? parseFloat(valor) : 0,
          data_inicio: dataInicio || new Date().toISOString().split("T")[0],
          data_fim: dataFim,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onCreated();
        onOpenChange(false);
      } else {
        setError(data.error || "Erro ao criar promoção");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao criar promoção");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-600" />
            Nova Promoção
          </DialogTitle>
          <DialogDescription>
            Crie uma promoção para um produto e gere oportunidades para os vendedores
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Título */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Título da Promoção *
              </label>
              <Input
                placeholder="Ex: Fio de COBRE 2,5mm com 15% OFF"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Descrição
              </label>
              <Input
                placeholder="Detalhes da promoção..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* Busca de Produto */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Produto Alvo *
              </label>
              {produtoSelecionado ? (
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {produtoSelecionado.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {produtoSelecionado.codigo_erp}
                      {produtoSelecionado.marca && ` • ${produtoSelecionado.marca}`}
                      {produtoSelecionado.preco_venda &&
                        ` • ${formatCurrency(produtoSelecionado.preco_venda)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProdutoId("");
                      setProdutoSelecionado(null);
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar produto por nome ou código..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                  />
                  {loadingProdutos && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                  {produtos.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {produtos.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          onClick={() => handleSelectProduto(p)}
                        >
                          <p className="font-medium text-sm text-slate-900 truncate">
                            {p.nome}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.codigo_erp}
                            {p.marca && ` • ${p.marca}`}
                            {p.preco_venda && ` • ${formatCurrency(p.preco_venda)}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo de Promoção */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Tipo de Promoção *
              </label>
              <Select value={tipoPromocao} onValueChange={setTipoPromocao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposPromocao.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <span className="flex items-center gap-2">
                        <span>{tipo.icon}</span>
                        <span>{tipo.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            {(tipoPromocao === "desconto_percentual" ||
              tipoPromocao === "desconto_fixo" ||
              tipoPromocao === "cashback") && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {tipoPromocao === "desconto_percentual"
                    ? "Percentual de Desconto *"
                    : tipoPromocao === "cashback"
                    ? "Valor do Cashback (R$) *"
                    : "Valor do Desconto (R$) *"}
                </label>
                <div className="relative">
                  {tipoPromocao === "desconto_percentual" && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      %
                    </span>
                  )}
                  {tipoPromocao !== "desconto_percentual" && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      R$
                    </span>
                  )}
                  <Input
                    type="number"
                    min="0"
                    max={tipoPromocao === "desconto_percentual" ? "100" : undefined}
                    step={tipoPromocao === "desconto_percentual" ? "1" : "0.01"}
                    className={
                      tipoPromocao === "desconto_percentual" ? "pl-8" : "pl-10"
                    }
                    placeholder={
                      tipoPromocao === "desconto_percentual" ? "15" : "0,00"
                    }
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Data Início
                </label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Data Fim *
                </label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Promoção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}