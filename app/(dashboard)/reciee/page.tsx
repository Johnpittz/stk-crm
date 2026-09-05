"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Plus,
  X,
  Loader2,
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
  competencia: string;
  consumo_kwh: number;
  tarifa_aplicada: number;
  valor_consumo: number;
  icms_valor: number;
  icms_aliquota: number;
  pis_valor: number;
  cofins_valor: number;
  bandeira: string;
  cip: number;
  valor_total: number;
  created_at: string;
}

interface AnaliseReciee {
  id: string;
  fatura_id: string;
  macro_indice: string;
  codigo: string;
  descricao: string;
  severidade: "critico" | "alerta" | "ok" | "info";
  valor_estimado: number;
  created_at: string;
}

export default function RecieePage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteReciee[]>([]);
  const [faturas, setFaturas] = useState<FaturaReciee[]>([]);
  const [analises, setAnalises] = useState<AnaliseReciee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Modal states
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [uploadSelectOpen, setUploadSelectOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [saving, setSaving] = useState(false);

  // Novo Cliente form
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

  // Upload Fatura form - redireciona para página de upload
  function handleUploadFatura() {
    if (!selectedClienteId) {
      alert("Selecione um cliente");
      return;
    }
    router.push(`/reciee/upload/${selectedClienteId}`);
  }

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const resClientes = await fetch("/api/reciee/clientes");
      const dataClientes = await resClientes.json();
      setClientes(dataClientes.clientes || []);

      const resFaturas = await fetch("/api/reciee/faturas");
      const dataFaturas = await resFaturas.json();
      setFaturas(dataFaturas.faturas || []);

      const resAnalises = await fetch("/api/reciee/analises");
      const dataAnalises = await resAnalises.json();
      setAnalises(dataAnalises.analises || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Criar cliente
  async function handleCriarCliente() {
    if (!formCliente.nome || !formCliente.cpf_cnpj || !formCliente.uc) {
      alert("Preencha nome, CPF/CNPJ e UC");
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
      setClientes([data.cliente, ...clientes]);
      setNovoClienteOpen(false);
      setFormCliente({
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
        grupo: "B",
      });
    } catch (error) {
      alert("Erro ao criar cliente");
    } finally {
      setSaving(false);
    }
  }

  // Criar fatura - agora redireciona para upload de PDF

  // Calcular estatísticas
  const totalClientes = clientes.length;
  const totalFaturas = faturas.length;
  const criticos = analises.filter((a) => a.severidade === "critico").length;
  const alertas = analises.filter((a) => a.severidade === "alerta").length;
  const estimativaRecuperacao = analises.reduce((acc, a) => acc + (a.valor_estimado || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B64CF] mx-auto"></div>
          <p className="mt-4 text-white/60">Carregando dados RECIEE...</p>
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
            RECIEE
          </h1>
          <p className="text-white/60">Recuperação de Cobranças Indevidas de Energia Elétrica</p>
        </div>
        <div className="flex gap-2">
          {/* Botão Upload Faturas - Seleciona cliente e vai para upload */}
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
                  Selecione o cliente para fazer upload das faturas PDF.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-white/80">Cliente *</Label>
                  <select
                    className="w-full bg-[#1a2744] border border-[#3B64CF]/30 rounded-md px-3 py-2 text-white mt-1"
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                  >
                    <option value="">Selecione o cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} - UC: {c.uc}
                      </option>
                    ))}
                  </select>
                </div>
                {clientes.length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">
                    Nenhum cliente cadastrado. Crie um cliente primeiro.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setUploadSelectOpen(false)}
                  className="border-white/20 text-white"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadFatura}
                  disabled={!selectedClienteId}
                  className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Ir para Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Botão Novo Cliente */}
          <Dialog open={novoClienteOpen} onOpenChange={setNovoClienteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#3B64CF] hover:bg-[#2a4fa8]">
                <FileText className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f1d32] border-[#3B64CF]/30 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Cliente RECIEE</DialogTitle>
                <DialogDescription className="text-white/60">
                  Cadastre um novo cliente para análise de cobranças indevidas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label className="text-white/80">Nome / Razão Social *</Label>
                  <Input
                    placeholder="Nome do cliente"
                    className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                    value={formCliente.nome}
                    onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80">CPF/CNPJ *</Label>
                    <Input
                      placeholder="00.000.000/0000-00"
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.cpf_cnpj}
                      onChange={(e) => setFormCliente({ ...formCliente, cpf_cnpj: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/80">UC *</Label>
                    <Input
                      placeholder="Unidade Consumidora"
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.uc}
                      onChange={(e) => setFormCliente({ ...formCliente, uc: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80">Estado</Label>
                    <Input
                      placeholder="UF"
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.estado}
                      onChange={(e) => setFormCliente({ ...formCliente, estado: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/80">Distribuidora</Label>
                    <Input
                      placeholder="Ex: CEMIG, CPFL..."
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.distribuidora}
                      onChange={(e) => setFormCliente({ ...formCliente, distribuidora: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80">Subgrupo</Label>
                    <Input
                      placeholder="Ex: A1, A2, A3, A4..."
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.subgrupo}
                      onChange={(e) => setFormCliente({ ...formCliente, subgrupo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/80">Modalidade</Label>
                    <Input
                      placeholder="Ex: Azul, Verde..."
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.modalidade}
                      onChange={(e) => setFormCliente({ ...formCliente, modalidade: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80">Classe</Label>
                    <Input
                      placeholder="Ex: Comercial, Industrial..."
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.classe}
                      onChange={(e) => setFormCliente({ ...formCliente, classe: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/80">Tensão</Label>
                    <Input
                      placeholder="Ex: Alta, Média, Baixa"
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.tensao}
                      onChange={(e) => setFormCliente({ ...formCliente, tensao: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80">Regime Tributário</Label>
                    <Input
                      placeholder="Ex: Simples Nacional, Lucro Presumido..."
                      className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                      value={formCliente.regime_tributario}
                      onChange={(e) => setFormCliente({ ...formCliente, regime_tributario: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/80">Grupo Tarifário</Label>
                    <select
                      className="w-full bg-[#1a2744] border border-[#3B64CF]/30 rounded-md px-3 py-2 text-white mt-1"
                      value={formCliente.grupo}
                      onChange={(e) => setFormCliente({ ...formCliente, grupo: e.target.value as "A" | "B" })}
                    >
                      <option value="A">Grupo A (Alta Tensão)</option>
                      <option value="B">Grupo B (Baixa Tensão)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gd"
                    className="rounded border-[#3B64CF]/30"
                    checked={formCliente.gd}
                    onChange={(e) => setFormCliente({ ...formCliente, gd: e.target.checked })}
                  />
                  <Label htmlFor="gd" className="text-white/80">Geração Distribuída (GD)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNovoClienteOpen(false)}
                  className="border-white/20 text-white"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCriarCliente}
                  disabled={saving}
                  className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  {saving ? "Salvando..." : "Salvar Cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0f1d32] border border-[#3B64CF]/20">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#3B64CF]">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="clientes" className="data-[state=active]:bg-[#3B64CF]">
            <Users className="h-4 w-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="faturas" className="data-[state=active]:bg-[#3B64CF]">
            <FileText className="h-4 w-4 mr-2" />
            Faturas
          </TabsTrigger>
          <TabsTrigger value="analises" className="data-[state=active]:bg-[#3B64CF]">
            <TrendingUp className="h-4 w-4 mr-2" />
            Análises
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Clientes</p>
                    <p className="text-2xl font-bold text-white">{totalClientes}</p>
                  </div>
                  <Users className="h-8 w-8 text-[#3B64CF]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Faturas</p>
                    <p className="text-2xl font-bold text-white">{totalFaturas}</p>
                  </div>
                  <FileText className="h-8 w-8 text-[#3B64CF]" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1d32] border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Críticos</p>
                    <p className="text-2xl font-bold text-red-400">{criticos}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1d32] border-yellow-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Alertas</p>
                    <p className="text-2xl font-bold text-yellow-400">{alertas}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1d32] border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">Est. Recuperação</p>
                    <p className="text-2xl font-bold text-green-400">
                      R$ {estimativaRecuperacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
            <CardHeader>
              <CardTitle className="text-white">Clientes Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {clientes.length === 0 ? (
                <p className="text-white/60 text-center py-8">
                  Nenhum cliente cadastrado. Clique em &quot;Novo Cliente&quot; para começar.
                </p>
              ) : (
                <div className="space-y-3">
                  {clientes.slice(0, 5).map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-3 bg-[#1a2744] rounded-lg hover:bg-[#1e2d4a] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#3B64CF]/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-[#3B64CF]" />
                        </div>
                        <div>
                          <p
                            className="text-white font-medium hover:text-[#3B64CF] cursor-pointer transition-colors"
                            onClick={() => router.push(`/reciee/${cliente.id}`)}
                          >
                            {cliente.nome}
                          </p>
                          <p className="text-sm text-white/60">
                            {cliente.cpf_cnpj} • UC: {cliente.uc}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-[#3B64CF]/30 text-[#3B64CF]">
                          {cliente.grupo === "A" ? "Grupo A" : "Grupo B"}
                        </Badge>
                        <Badge variant="outline" className="border-white/20 text-white/60">
                          {cliente.estado}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clientes Tab */}
        <TabsContent value="clientes" className="space-y-6">
          <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Todos os Clientes</CardTitle>
                <Button
                  onClick={() => setNovoClienteOpen(true)}
                  className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clientes.length === 0 ? (
                <p className="text-white/60 text-center py-8">Nenhum cliente cadastrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#3B64CF]/20">
                        <th className="text-left p-3 text-white/60 font-medium">Nome</th>
                        <th className="text-left p-3 text-white/60 font-medium">CPF/CNPJ</th>
                        <th className="text-left p-3 text-white/60 font-medium">UC</th>
                        <th className="text-left p-3 text-white/60 font-medium">Grupo</th>
                        <th className="text-left p-3 text-white/60 font-medium">Subgrupo</th>
                        <th className="text-left p-3 text-white/60 font-medium">Estado</th>
                        <th className="text-left p-3 text-white/60 font-medium">Distribuidora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((cliente) => (
                        <tr
                          key={cliente.id}
                          className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744] cursor-pointer"
                        >
                          <td
                            className="p-3 text-white hover:text-[#3B64CF] cursor-pointer transition-colors"
                            onClick={() => router.push(`/reciee/${cliente.id}`)}
                          >
                            {cliente.nome}
                          </td>
                          <td className="p-3 text-white/80">{cliente.cpf_cnpj}</td>
                          <td className="p-3 text-white/80">{cliente.uc}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                cliente.grupo === "A"
                                  ? "border-blue-500/30 text-blue-400"
                                  : "border-green-500/30 text-green-400"
                              }
                            >
                              {cliente.grupo === "A" ? "Grupo A" : "Grupo B"}
                            </Badge>
                          </td>
                          <td className="p-3 text-white/80">{cliente.subgrupo}</td>
                          <td className="p-3 text-white/80">{cliente.estado}</td>
                          <td className="p-3 text-white/80">{cliente.distribuidora}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faturas Tab */}
        <TabsContent value="faturas" className="space-y-6">
          <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Faturas Processadas</CardTitle>
                <Button
                  onClick={() => setUploadSelectOpen(true)}
                  className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Fatura
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {faturas.length === 0 ? (
                <p className="text-white/60 text-center py-8">
                  Nenhuma fatura processada. Faça upload de faturas PDF para começar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#3B64CF]/20">
                        <th className="text-left p-3 text-white/60 font-medium">Competência</th>
                        <th className="text-left p-3 text-white/60 font-medium">Consumo</th>
                        <th className="text-left p-3 text-white/60 font-medium">Tarifa</th>
                        <th className="text-left p-3 text-white/60 font-medium">ICMS</th>
                        <th className="text-left p-3 text-white/60 font-medium">PIS/COFINS</th>
                        <th className="text-left p-3 text-white/60 font-medium">Bandeira</th>
                        <th className="text-left p-3 text-white/60 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faturas.map((fatura) => (
                        <tr
                          key={fatura.id}
                          className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744] cursor-pointer"
                        >
                          <td className="p-3 text-white">{fatura.competencia}</td>
                          <td className="p-3 text-white/80">{fatura.consumo_kwh} kWh</td>
                          <td className="p-3 text-white/80">
                            R$ {fatura.tarifa_aplicada.toFixed(4)}/kWh
                          </td>
                          <td className="p-3 text-white/80">
                            {fatura.icms_aliquota}% (R$ {fatura.icms_valor.toFixed(2)})
                          </td>
                          <td className="p-3 text-white/80">
                            R$ {(fatura.pis_valor + fatura.cofins_valor).toFixed(2)}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                fatura.bandeira === "Verde"
                                  ? "border-green-500/30 text-green-400"
                                  : fatura.bandeira === "Amarela"
                                  ? "border-yellow-500/30 text-yellow-400"
                                  : "border-red-500/30 text-red-400"
                              }
                            >
                              {fatura.bandeira}
                            </Badge>
                          </td>
                          <td className="p-3 text-white font-medium">
                            R$ {fatura.valor_total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análises Tab */}
        <TabsContent value="analises" className="space-y-6">
          <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
            <CardHeader>
              <CardTitle className="text-white">Análises RECIEE</CardTitle>
            </CardHeader>
            <CardContent>
              {analises.length === 0 ? (
                <p className="text-white/60 text-center py-8">
                  Nenhuma análise realizada. Faça upload de faturas e execute a análise.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#3B64CF]/20">
                        <th className="text-left p-3 text-white/60 font-medium">Código</th>
                        <th className="text-left p-3 text-white/60 font-medium">Descrição</th>
                        <th className="text-left p-3 text-white/60 font-medium">Severidade</th>
                        <th className="text-left p-3 text-white/60 font-medium">Valor Estimado</th>
                        <th className="text-left p-3 text-white/60 font-medium">Macro-Índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analises.map((analise) => (
                        <tr
                          key={analise.id}
                          className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744] cursor-pointer"
                        >
                          <td className="p-3 text-white font-mono">{analise.codigo}</td>
                          <td className="p-3 text-white/80">{analise.descricao}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                analise.severidade === "critico"
                                  ? "border-red-500/30 text-red-400"
                                  : analise.severidade === "alerta"
                                  ? "border-yellow-500/30 text-yellow-400"
                                  : analise.severidade === "ok"
                                  ? "border-green-500/30 text-green-400"
                                  : "border-blue-500/30 text-blue-400"
                              }
                            >
                              {analise.severidade === "critico"
                                ? "🔴 Crítico"
                                : analise.severidade === "alerta"
                                ? "🟡 Alerta"
                                : analise.severidade === "ok"
                                ? "🟢 OK"
                                : "🔵 Info"}
                            </Badge>
                          </td>
                          <td className="p-3 text-white font-medium">
                            R$ {analise.valor_estimado.toFixed(2)}
                          </td>
                          <td className="p-3 text-white/80">{analise.macro_indice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
