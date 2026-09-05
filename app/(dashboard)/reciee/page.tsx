"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Zap,
  FileText,
  Upload,
  BarChart3,
  Users,
  Plus,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";

interface ClienteReciee {
  id: string;
  nome: string;
  cpf_cnpj: string;
  uc: string;
  estado: string;
  distribuidora: string;
  subgrupo: string;
  modalidade: string;
  classe: string;
  tensao: string;
  regime_tributario: string;
  gd: boolean;
  grupo: "A" | "B";
  created_at: string;
}

interface FaturaReciee {
  id: string;
  cliente_id: string;
}

interface AnaliseReciee {
  id: string;
  cliente_id: string;
}

export default function RecieePage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteReciee[]>([]);
  const [faturasMap, setFaturasMap] = useState<Record<string, number>>({});
  const [analisesMap, setAnalisesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [editarClienteOpen, setEditarClienteOpen] = useState(false);
  const [uploadSelectOpen, setUploadSelectOpen] = useState(false);
  const [excluirConfirmOpen, setExcluirConfirmOpen] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<ClienteReciee | null>(null);
  const [clienteParaEditar, setClienteParaEditar] = useState<ClienteReciee | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState("");

  // Form novo cliente
  const [formCliente, setFormCliente] = useState({
    nome: "",
    cpf_cnpj: "",
    uc: "",
    estado: "",
    distribuidora: "",
    subgrupo: "",
    modalidade: "",
    classe: "",
    tensao: "",
    regime_tributario: "",
    gd: false,
    grupo: "B" as "A" | "B",
  });

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const resClientes = await fetch("/api/reciee/clientes");
      const dataClientes = await resClientes.json();
      const clientesList = dataClientes.clientes || [];
      setClientes(clientesList);

      // Carregar contagem de faturas e análises por cliente
      const fMap: Record<string, number> = {};
      const aMap: Record<string, number> = {};

      for (const c of clientesList) {
        try {
          const [resF, resA] = await Promise.all([
            fetch(`/api/reciee/faturas?cliente_id=${c.id}`),
            fetch(`/api/reciee/analises?cliente_id=${c.id}`),
          ]);
          const dataF = await resF.json();
          const dataA = await resA.json();
          fMap[c.id] = (dataF.faturas || []).length;
          aMap[c.id] = (dataA.analises || []).length;
        } catch {
          fMap[c.id] = 0;
          aMap[c.id] = 0;
        }
      }
      setFaturasMap(fMap);
      setAnalisesMap(aMap);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Criar cliente
  async function handleCriarCliente() {
    if (!formCliente.nome || !formCliente.cpf_cnpj) {
      alert("Preencha nome e CPF/CNPJ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reciee/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formCliente),
      });
      const data = await res.json();
      if (data.error) {
        alert("Erro: " + data.error);
        return;
      }
      setNovoClienteOpen(false);
      setFormCliente({
        nome: "", cpf_cnpj: "", uc: "", estado: "", distribuidora: "",
        subgrupo: "", modalidade: "", classe: "", tensao: "",
        regime_tributario: "", gd: false, grupo: "B",
      });
      carregarDados();
    } catch {
      alert("Erro ao criar cliente");
    } finally {
      setSaving(false);
    }
  }

  // Editar cliente
  function abrirEditar(cliente: ClienteReciee) {
    setClienteParaEditar(cliente);
    setFormCliente({
      nome: cliente.nome,
      cpf_cnpj: cliente.cpf_cnpj || "",
      uc: cliente.uc || "",
      estado: cliente.estado || "",
      distribuidora: cliente.distribuidora || "",
      subgrupo: cliente.subgrupo || "",
      modalidade: cliente.modalidade || "",
      classe: cliente.classe || "",
      tensao: cliente.tensao || "",
      regime_tributario: cliente.regime_tributario || "",
      gd: cliente.gd || false,
      grupo: cliente.grupo || "B",
    });
    setEditarClienteOpen(true);
  }

  async function handleSalvarEdicao() {
    if (!clienteParaEditar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/reciee/clientes/${clienteParaEditar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formCliente),
      });
      const data = await res.json();
      if (data.error) {
        alert("Erro: " + data.error);
        return;
      }
      setEditarClienteOpen(false);
      carregarDados();
    } catch {
      alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  // Excluir cliente
  async function handleExcluir() {
    if (!clienteParaExcluir) return;
    try {
      await fetch(`/api/reciee/clientes/${clienteParaExcluir.id}`, {
        method: "DELETE",
      });
      setExcluirConfirmOpen(false);
      setClienteParaExcluir(null);
      carregarDados();
    } catch {
      alert("Erro ao excluir");
    }
  }

  // Upload Faturas
  function handleUploadFatura() {
    if (!selectedClienteId) {
      alert("Selecione um cliente");
      return;
    }
    router.push(`/reciee/upload/${selectedClienteId}`);
  }

  // Totais
  const totalClientes = clientes.length;
  const totalFaturas = Object.values(faturasMap).reduce((a, b) => a + b, 0);
  const totalAnalises = Object.values(analisesMap).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B64CF] mx-auto"></div>
          <p className="mt-4 text-white/60">Carregando RECIEE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            Painel de Clientes
          </h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadSelectOpen} onOpenChange={setUploadSelectOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#3B64CF]/30 text-white hover:bg-[#3B64CF]/20">
                <Upload className="h-4 w-4 mr-2" />
                Upload Faturas
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f1d32] border-[#3B64CF]/30 text-white max-w-md">
              <DialogHeader>
                <DialogTitle>Upload de Faturas</DialogTitle>
                <DialogDescription className="text-white/60">
                  Selecione o cliente para upload.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label className="text-white/80">Cliente</Label>
                <select
                  className="w-full bg-[#1a2744] border border-[#3B64CF]/30 rounded-md px-3 py-2 text-white mt-1"
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadSelectOpen(false)} className="border-white/20 text-white">
                  Cancelar
                </Button>
                <Button onClick={handleUploadFatura} disabled={!selectedClienteId} className="bg-[#3B64CF] hover:bg-[#2a4fa8]">
                  <Upload className="h-4 w-4 mr-2" /> Ir para Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={novoClienteOpen} onOpenChange={setNovoClienteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#3B64CF] hover:bg-[#2a4fa8]">
                <Plus className="h-4 w-4 mr-2" />
                + Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f1d32] border-[#3B64CF]/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Cliente RECIEE</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-white/80">Nome *</Label>
                  <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.nome} onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/80">CPF/CNPJ *</Label>
                    <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.cpf_cnpj} onChange={(e) => setFormCliente({ ...formCliente, cpf_cnpj: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-white/80">UC</Label>
                    <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.uc} onChange={(e) => setFormCliente({ ...formCliente, uc: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/80">Estado</Label>
                    <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.estado} onChange={(e) => setFormCliente({ ...formCliente, estado: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-white/80">Distribuidora</Label>
                    <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.distribuidora} onChange={(e) => setFormCliente({ ...formCliente, distribuidora: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/80">Grupo</Label>
                    <select className="w-full bg-[#1a2744] border border-[#3B64CF]/30 rounded-md px-3 py-2 text-white mt-1" value={formCliente.grupo} onChange={(e) => setFormCliente({ ...formCliente, grupo: e.target.value as "A" | "B" })}>
                      <option value="A">Grupo A</option>
                      <option value="B">Grupo B</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-white/80">Subgrupo</Label>
                    <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.subgrupo} onChange={(e) => setFormCliente({ ...formCliente, subgrupo: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="gd-novo" className="rounded" checked={formCliente.gd} onChange={(e) => setFormCliente({ ...formCliente, gd: e.target.checked })} />
                  <Label htmlFor="gd-novo" className="text-white/80">Geração Distribuída</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovoClienteOpen(false)} className="border-white/20 text-white">Cancelar</Button>
                <Button onClick={handleCriarCliente} disabled={saving} className="bg-[#3B64CF] hover:bg-[#2a4fa8]">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-[#3B64CF]">{totalClientes}</p>
            <p className="text-white/60 mt-1">Clientes Cadastrados</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-[#3B64CF]">{totalFaturas}</p>
            <p className="text-white/60 mt-1">Faturas Processadas</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-[#3B64CF]">{totalAnalises}</p>
            <p className="text-white/60 mt-1">Análises Realizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Clientes */}
      <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a2744] border-b border-[#3B64CF]/20">
                  <th className="text-left p-4 text-white/80 font-medium">Cliente</th>
                  <th className="text-left p-4 text-white/80 font-medium">CPF/CNPJ</th>
                  <th className="text-left p-4 text-white/80 font-medium">UC</th>
                  <th className="text-left p-4 text-white/80 font-medium">Estado</th>
                  <th className="text-left p-4 text-white/80 font-medium">Distribuidora</th>
                  <th className="text-left p-4 text-white/80 font-medium">Grupo</th>
                  <th className="text-center p-4 text-white/80 font-medium">Faturas</th>
                  <th className="text-center p-4 text-white/80 font-medium">Análises</th>
                  <th className="text-left p-4 text-white/80 font-medium">Criado em</th>
                  <th className="text-center p-4 text-white/80 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-white/40">
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => (
                    <tr key={cliente.id} className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744]/50 transition-colors">
                      <td
                        className="p-4 text-white font-medium hover:text-[#3B64CF] cursor-pointer"
                        onClick={() => router.push(`/reciee/${cliente.id}`)}
                      >
                        {cliente.nome}
                      </td>
                      <td className="p-4 text-white/70">{cliente.cpf_cnpj || "—"}</td>
                      <td className="p-4 text-white/70">{cliente.uc || "—"}</td>
                      <td className="p-4">
                        {cliente.estado && (
                          <Badge variant="outline" className="border-[#3B64CF]/30 text-[#3B64CF]">
                            {cliente.estado}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-white/70">{cliente.distribuidora || "—"}</td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className={cliente.grupo === "A" ? "border-blue-500/30 text-blue-400" : "border-green-500/30 text-green-400"}
                        >
                          {cliente.grupo === "A" ? "Grupo A" : "Grupo B"}
                        </Badge>
                      </td>
                      <td className="p-4 text-center text-white/70">{faturasMap[cliente.id] || 0}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
                          {analisesMap[cliente.id] || 0}
                        </span>
                      </td>
                      <td className="p-4 text-white/50 text-sm">
                        {cliente.created_at ? new Date(cliente.created_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/reciee/${cliente.id}`)}
                            className="text-[#3B64CF] hover:text-white hover:bg-[#3B64CF]/20 h-8 px-2"
                            title="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirEditar(cliente)}
                            className="text-[#3B64CF] hover:text-white hover:bg-[#3B64CF]/20 h-8 px-2"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setClienteParaExcluir(cliente); setExcluirConfirmOpen(true); }}
                            className="text-red-400 hover:text-white hover:bg-red-500/20 h-8 px-2"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Editar Cliente */}
      <Dialog open={editarClienteOpen} onOpenChange={setEditarClienteOpen}>
        <DialogContent className="bg-[#0f1d32] border-[#3B64CF]/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white/80">Nome</Label>
              <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.nome} onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/80">CPF/CNPJ</Label>
                <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.cpf_cnpj} onChange={(e) => setFormCliente({ ...formCliente, cpf_cnpj: e.target.value })} />
              </div>
              <div>
                <Label className="text-white/80">UC</Label>
                <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.uc} onChange={(e) => setFormCliente({ ...formCliente, uc: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/80">Estado</Label>
                <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.estado} onChange={(e) => setFormCliente({ ...formCliente, estado: e.target.value })} />
              </div>
              <div>
                <Label className="text-white/80">Distribuidora</Label>
                <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.distribuidora} onChange={(e) => setFormCliente({ ...formCliente, distribuidora: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/80">Grupo</Label>
                <select className="w-full bg-[#1a2744] border border-[#3B64CF]/30 rounded-md px-3 py-2 text-white mt-1" value={formCliente.grupo} onChange={(e) => setFormCliente({ ...formCliente, grupo: e.target.value as "A" | "B" })}>
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                </select>
              </div>
              <div>
                <Label className="text-white/80">Subgrupo</Label>
                <Input className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1" value={formCliente.subgrupo} onChange={(e) => setFormCliente({ ...formCliente, subgrupo: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="gd-editar" className="rounded" checked={formCliente.gd} onChange={(e) => setFormCliente({ ...formCliente, gd: e.target.checked })} />
              <Label htmlFor="gd-editar" className="text-white/80">Geração Distribuída</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditarClienteOpen(false)} className="border-white/20 text-white">Cancelar</Button>
            <Button onClick={handleSalvarEdicao} disabled={saving} className="bg-[#3B64CF] hover:bg-[#2a4fa8]">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={excluirConfirmOpen} onOpenChange={setExcluirConfirmOpen}>
        <DialogContent className="bg-[#0f1d32] border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Excluir Cliente</DialogTitle>
            <DialogDescription className="text-white/60">
              Tem certeza que deseja excluir <strong className="text-white">{clienteParaExcluir?.nome}</strong>?
              <br />Todas as faturas e análises associadas serão apagadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirConfirmOpen(false)} className="border-white/20 text-white">Cancelar</Button>
            <Button onClick={handleExcluir} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
