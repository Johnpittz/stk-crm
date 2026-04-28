"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Boxes
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

interface Produto {
  id: string;
  codigo_erp: string;
  sku: string;
  nome: string;
  descricao: string | null;
  preco_custo: number | null;
  preco_venda: number | null;
  ativo: boolean;
  marca?: string | null;
  categoria_nome?: string | null;
  status_produto?: string | null;
  referencia?: string | null;
  colecao?: string | null;
  fornecedor?: string | null;
  bloqueia_venda?: boolean;
  bloqueia_pedido?: boolean;
  created_at: string;
}

interface Filtros {
  marcas: string[];
  categorias: string[];
  status: string[];
}

export default function ProdutosPage() {
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ marcas: [], categorias: [], status: [] });
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limite = 50;

  const supabase = createClient();

  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (busca) params.append("busca", busca);
      if (filtroMarca) params.append("marca", filtroMarca);
      if (filtroCategoria) params.append("categoria", filtroCategoria);
      if (filtroStatus) params.append("status", filtroStatus);
      params.append("limite", String(limite));
      params.append("offset", String(offset));

      const res = await fetch(`/api/produtos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao carregar produtos");
        setLoading(false);
        return;
      }

      setProdutos(data.produtos || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  // Busca filtros apenas 1x no mount
  const fetchFiltros = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/produtos/filtros", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setFiltros({
          marcas: data.marcas || [],
          categorias: data.categorias || [],
          status: data.status || [],
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, [busca, filtroMarca, filtroCategoria, filtroStatus, offset]);

  useEffect(() => {
    fetchFiltros();
  }, []);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const stats = {
    total: total,
    ativos: produtos.filter(p => p.ativo).length,
    bloqueados: produtos.filter(p => p.bloqueia_venda || p.bloqueia_pedido).length,
    sem_preco: produtos.filter(p => !p.preco_venda || p.preco_venda === 0).length,
  };

  const totalPaginas = Math.ceil(total / limite);
  const paginaAtual = Math.floor(offset / limite) + 1;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Produtos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.ativos}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Bloqueados</p>
                <p className="text-2xl font-bold text-red-600">{stats.bloqueados}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sem Preço</p>
                <p className="text-2xl font-bold text-amber-600">{stats.sem_preco}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          Erro: {error}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de Produtos
          </CardTitle>
          <CardDescription>
            {total} produtos cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, código ou SKU..."
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setOffset(0); }}
                className="pl-9"
              />
            </div>

            {filtros.marcas.length > 0 && (
              <select
                value={filtroMarca}
                onChange={(e) => { setFiltroMarca(e.target.value); setOffset(0); }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as marcas</option>
                {filtros.marcas.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {filtros.categorias.length > 0 && (
              <select
                value={filtroCategoria}
                onChange={(e) => { setFiltroCategoria(e.target.value); setOffset(0); }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as categorias</option>
                {filtros.categorias.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {filtros.status.length > 0 && (
              <select
                value={filtroStatus}
                onChange={(e) => { setFiltroStatus(e.target.value); setOffset(0); }}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os status</option>
                {filtros.status.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tabela */}
          <ScrollArea className="h-[500px] border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-600">SKU</th>
                  <th className="text-left p-3 font-medium text-slate-600">Nome</th>
                  <th className="text-left p-3 font-medium text-slate-600">Marca</th>
                  <th className="text-left p-3 font-medium text-slate-600">Categoria</th>
                  <th className="text-right p-3 font-medium text-slate-600">Custo</th>
                  <th className="text-right p-3 font-medium text-slate-600">Preço Venda</th>
                  <th className="text-center p-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
                      <p className="text-slate-500 mt-2">Carregando produtos...</p>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum produto encontrado
                    </td>
                  </tr>
                ) : (
                  produtos.map((produto) => (
                    <tr key={produto.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-mono text-sm font-medium text-slate-700">
                        {produto.codigo_erp || produto.sku || "—"}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{produto.nome}</div>
                      </td>
                      <td className="p-3 text-slate-600">{produto.marca || "—"}</td>
                      <td className="p-3 text-slate-600">{produto.categoria_nome || "—"}</td>
                      <td className="p-3 text-right text-slate-600">
                        {formatCurrency(produto.preco_custo)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(produto.preco_venda)}
                      </td>
                      <td className="p-3 text-center">
                        {produto.bloqueia_venda || produto.bloqueia_pedido ? (
                          <Badge variant="destructive" className="text-xs">
                            Bloqueado
                          </Badge>
                        ) : produto.ativo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>

          {/* Paginação */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Mostrando {offset + 1} a {Math.min(offset + limite, total)} de {total} produtos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limite))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limite)}
                  disabled={offset + limite >= total}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
