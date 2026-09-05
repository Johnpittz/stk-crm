"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  AlertTriangle,
  FileText,
  Upload,
  BarChart3,
  DollarSign,
  Loader2,
  Pencil,
  RefreshCw,
  FileSpreadsheet,
  FileDown,
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
  telefone?: string;
  endereco?: string;
  cidade?: string;
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
  cliente_id: string;
  macro_indice: string;
  codigo: string;
  descricao: string;
  severidade: "critico" | "alerta" | "ok" | "info";
  valor_estimado: number;
  periodo?: string;
  created_at: string;
}

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;

  const [cliente, setCliente] = useState<ClienteReciee | null>(null);
  const [faturas, setFaturas] = useState<FaturaReciee[]>([]);
  const [analises, setAnalises] = useState<AnaliseReciee[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClienteReciee>>({});
  const [saving, setSaving] = useState(false);

  // Action loading states
  const [reAnalisando, setReAnalisando] = useState(false);
  const [gerandoExcel, setGerandoExcel] = useState(false);
  const [gerandoProposta, setGerandoProposta] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [clienteId]);

  async function carregarDados() {
    setLoading(true);
    try {
      const resClientes = await fetch("/api/reciee/clientes");
      const dataClientes = await resClientes.json();
      const c = dataClientes.clientes?.find(
        (cl: ClienteReciee) => cl.id === clienteId
      );
      setCliente(c || null);

      const resFaturas = await fetch(
        `/api/reciee/faturas?cliente_id=${clienteId}`
      );
      const dataFaturas = await resFaturas.json();
      setFaturas(dataFaturas.faturas || []);

      const resAnalises = await fetch(
        `/api/reciee/analises?cliente_id=${clienteId}`
      );
      const dataAnalises = await resAnalises.json();
      setAnalises(dataAnalises.analises || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- Stats ---
  const totalFaturas = faturas.length;
  const criticos = analises.filter((a) => a.severidade === "critico").length;
  const alertas = analises.filter((a) => a.severidade === "alerta").length;
  const infoCount = analises.filter(
    (a) => a.severidade === "info" || a.severidade === "ok"
  ).length;
  const estimativaRecuperacao = analises.reduce(
    (acc, a) => acc + (a.valor_estimado || 0),
    0
  );

  // --- Edit handlers ---
  function openEditDialog() {
    setEditForm({
      nome: cliente?.nome || "",
      cpf_cnpj: cliente?.cpf_cnpj || "",
      telefone: cliente?.telefone || "",
      uc: cliente?.uc || "",
      estado: cliente?.estado || "",
      distribuidora: cliente?.distribuidora || "",
      endereco: cliente?.endereco || "",
      cidade: cliente?.cidade || "",
      subgrupo: cliente?.subgrupo || "",
      grupo: cliente?.grupo || "A",
      regime_tributario: cliente?.regime_tributario || "",
      gd: cliente?.gd || false,
      modalidade: cliente?.modalidade || "",
      classe: cliente?.classe || "",
      tensao: cliente?.tensao || "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/reciee/clientes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clienteId, ...editForm }),
      });
      if (res.ok) {
        setEditOpen(false);
        await carregarDados();
      } else {
        alert("Erro ao salvar cliente");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  }

  // --- Action handlers ---
  async function handleReAnalisar() {
    setReAnalisando(true);
    try {
      const res = await fetch(
        `/api/reciee/clientes/${clienteId}/re-analisar`,
        { method: "POST" }
      );
      if (res.ok) {
        await carregarDados();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao re-analisar");
      }
    } catch (error) {
      console.error("Erro ao re-analisar:", error);
      alert("Erro ao re-analisar");
    } finally {
      setReAnalisando(false);
    }
  }

  async function handleGerarExcel() {
    setGerandoExcel(true);
    try {
      const res = await fetch(
        `/api/reciee/clientes/${clienteId}/relatorio`,
        { method: "POST" }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio_${cliente?.nome || clienteId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert("Erro ao gerar relatório");
      }
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      alert("Erro ao gerar relatório");
    } finally {
      setGerandoExcel(false);
    }
  }

  async function handleGerarProposta() {
    setGerandoProposta(true);
    try {
      const res = await fetch(
        `/api/reciee/clientes/${clienteId}/proposta`,
        { method: "POST" }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `proposta_${cliente?.nome || clienteId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert("Erro ao gerar proposta");
      }
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      alert("Erro ao gerar proposta");
    } finally {
      setGerandoProposta(false);
    }
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B64CF] mx-auto"></div>
          <p className="mt-4 text-white/60">Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">Cliente não encontrado</p>
        <Button
          onClick={() => router.push("/reciee")}
          className="mt-4 bg-[#3B64CF] hover:bg-[#2a4fa8]"
        >
          Voltar ao RECIEE
        </Button>
      </div>
    );
  }

  // --- Client detail grid fields ---
  const clientFields = [
    { label: "CPF/CNPJ", value: cliente.cpf_cnpj },
    { label: "Telefone", value: cliente.telefone || "—" },
    { label: "UC", value: cliente.uc },
    { label: "Estado", value: cliente.estado },
    { label: "Distribuidora", value: cliente.distribuidora },
    { label: "Endereço", value: cliente.endereco || "—" },
    { label: "Cidade", value: cliente.cidade || "—" },
    { label: "Subgrupo", value: cliente.subgrupo },
    { label: "Grupo", value: cliente.grupo === "A" ? "Grupo A" : "Grupo B" },
    { label: "Regime", value: cliente.regime_tributario },
    { label: "GD", value: cliente.gd ? "Sim" : "Não" },
  ];

  return (
    <div className="space-y-6 bg-[#0f1d32] min-h-screen p-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/reciee")}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-[#3B64CF]" />
              {cliente.nome}
            </h1>
            <p className="text-white/60">
              {cliente.cpf_cnpj} • UC: {cliente.uc} • {cliente.estado}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={openEditDialog}
            className="border-[#3B64CF]/40 text-white hover:bg-[#3B64CF]/20"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/reciee/upload/${clienteId}`)}
            className="border-[#3B64CF]/40 text-white hover:bg-[#3B64CF]/20"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Faturas
          </Button>
          <Button
            variant="outline"
            onClick={handleReAnalisar}
            disabled={reAnalisando}
            className="border-[#3B64CF]/40 text-white hover:bg-[#3B64CF]/20"
          >
            {reAnalisando ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Re-Analisar
          </Button>
          <Button
            variant="outline"
            onClick={handleGerarExcel}
            disabled={gerandoExcel}
            className="border-[#3B64CF]/40 text-white hover:bg-[#3B64CF]/20"
          >
            {gerandoExcel ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-1" />
            )}
            Gerar Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleGerarProposta}
            disabled={gerandoProposta}
            className="border-[#3B64CF]/40 text-white hover:bg-[#3B64CF]/20"
          >
            {gerandoProposta ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-1" />
            )}
            Gerar Proposta
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Faturas */}
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

        {/* Críticos (red) */}
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

        {/* Alertas (yellow) */}
        <Card className="bg-[#0f1d32] border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Alertas</p>
                <p className="text-2xl font-bold text-yellow-400">{alertas}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        {/* Info (blue) */}
        <Card className="bg-[#0f1d32] border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Info</p>
                <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Estimativa de Recuperação (green) */}
        <Card className="bg-[#0f1d32] border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Est. Recuperação</p>
                <p className="text-2xl font-bold text-green-400">
                  R${" "}
                  {estimativaRecuperacao.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Dados do Cliente ── */}
      <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#3B64CF]" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {clientFields.map((field) => (
              <div key={field.label}>
                <p className="text-sm text-white/50">{field.label}</p>
                <p className="text-white font-medium">{field.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Análises Encontradas ── */}
      <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#3B64CF]" />
            Análises Encontradas ({analises.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analises.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                Nenhuma análise realizada para este cliente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#3B64CF]/20">
                    <th className="text-left p-3 text-white/60 font-medium">
                      Severidade
                    </th>
                    <th className="text-left p-3 text-white/60 font-medium">
                      Macro-Índice
                    </th>
                    <th className="text-left p-3 text-white/60 font-medium">
                      Código
                    </th>
                    <th className="text-left p-3 text-white/60 font-medium">
                      Descrição
                    </th>
                    <th className="text-left p-3 text-white/60 font-medium">
                      Período
                    </th>
                    <th className="text-right p-3 text-white/60 font-medium">
                      Valor Estimado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analises.map((analise) => (
                    <tr
                      key={analise.id}
                      className={`border-b border-[#3B64CF]/10 hover:bg-[#1a2744] transition-colors ${
                        analise.severidade === "critico"
                          ? "border-l-4 border-l-red-500"
                          : ""
                      }`}
                    >
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
                      <td className="p-3 text-white/80">
                        {analise.macro_indice}
                      </td>
                      <td className="p-3 text-white font-mono">
                        {analise.codigo}
                      </td>
                      <td className="p-3 text-white/80">{analise.descricao}</td>
                      <td className="p-3 text-white/60">
                        {analise.periodo || "—"}
                      </td>
                      <td className="p-3 text-white font-medium text-right">
                        R${" "}
                        {(analise.valor_estimado || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#0f1d32] border-[#3B64CF]/20 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Editar Cliente — {cliente.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
            {[
              { key: "nome", label: "Nome", type: "text" },
              { key: "cpf_cnpj", label: "CPF/CNPJ", type: "text" },
              { key: "telefone", label: "Telefone", type: "text" },
              { key: "uc", label: "UC", type: "text" },
              { key: "estado", label: "Estado", type: "text" },
              { key: "distribuidora", label: "Distribuidora", type: "text" },
              { key: "endereco", label: "Endereço", type: "text" },
              { key: "cidade", label: "Cidade", type: "text" },
              { key: "subgrupo", label: "Subgrupo", type: "text" },
              { key: "grupo", label: "Grupo", type: "text" },
              { key: "regime_tributario", label: "Regime Tributário", type: "text" },
              { key: "modalidade", label: "Modalidade", type: "text" },
              { key: "classe", label: "Classe", type: "text" },
              { key: "tensao", label: "Tensão", type: "text" },
            ].map((field) => (
              <div key={field.key}>
                <Label className="text-white/70">{field.label}</Label>
                <Input
                  type={field.type}
                  value={(editForm as any)[field.key] || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, [field.key]: e.target.value })
                  }
                  className="bg-[#1a2744] border-[#3B64CF]/30 text-white mt-1"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Label className="text-white/70">GD</Label>
              <input
                type="checkbox"
                checked={editForm.gd || false}
                onChange={(e) =>
                  setEditForm({ ...editForm, gd: e.target.checked })
                }
                className="h-4 w-4 accent-[#3B64CF]"
              />
              <span className="text-white/60 text-sm">
                {editForm.gd ? "Sim" : "Não"}
              </span>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="text-white/60 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveEdit}
              disabled={saving}
              className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
