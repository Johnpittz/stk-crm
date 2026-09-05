"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Upload,
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
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
  grupo: "A" | "B";
  created_at: string;
}

export default function UploadFaturasPage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cliente, setCliente] = useState<ClienteReciee | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    faturas_extraidas?: number;
    analises_geradas?: number;
    erros?: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Carregar dados do cliente
  useEffect(() => {
    async function carregarCliente() {
      try {
        const res = await fetch("/api/reciee/clientes");
        const data = await res.json();
        const c = data.clientes?.find((cl: ClienteReciee) => cl.id === clienteId);
        if (c) setCliente(c);
      } catch (error) {
        console.error("Erro ao carregar cliente:", error);
      } finally {
        setLoading(false);
      }
    }
    carregarCliente();
  }, [clienteId]);

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Upload e processamento — envia um arquivo por vez para não estourar limite do Vercel
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  async function handleUpload() {
    if (files.length === 0 || !cliente) return;

    setUploading(true);
    setResult(null);
    setUploadProgress({ current: 0, total: files.length });

    let totalFaturas = 0;
    let totalAnalises = 0;
    const allErros: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });

        const formData = new FormData();
        formData.append("faturas", files[i]);

        const res = await fetch(`/api/reciee/upload/${clienteId}`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok) {
          totalFaturas += data.faturas_extraidas || 0;
          totalAnalises += data.analises_geradas || 0;
          if (data.erros?.length) allErros.push(...data.erros);
        } else {
          allErros.push(`${files[i].name}: ${data.error || "Erro desconhecido"}`);
          if (data.erros?.length) allErros.push(...data.erros);
        }
      }

      setResult({
        success: totalFaturas > 0,
        faturas_extraidas: totalFaturas,
        analises_geradas: totalAnalises,
        erros: allErros.length > 0 ? allErros : undefined,
      });
    } catch (error: any) {
      setResult({
        success: false,
        erros: [error.message || "Erro ao enviar arquivos"],
      });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B64CF] mx-auto"></div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">Cliente não encontrado</p>
        <Button onClick={() => router.push("/reciee")} className="mt-4">
          Voltar ao RECIEE
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              <Upload className="h-6 w-6 text-blue-400" />
              Upload de Faturas
            </h1>
          </div>
        </div>
      </div>

      {/* Info do Cliente */}
      <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-white font-semibold text-lg">{cliente.nome}</h3>
        <p className="text-white/70 text-sm">
          <strong>Estado:</strong> {cliente.estado} | <strong>Distribuidora:</strong>{" "}
          {cliente.distribuidora} | <strong>Grupo:</strong> {cliente.grupo}
        </p>
      </div>

      {/* Resultado */}
      {result && (
        <Card
          className={
            result.success
              ? "bg-green-900/20 border-green-500/30"
              : "bg-red-900/20 border-red-500/30"
          }
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-400 mt-0.5" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-400 mt-0.5" />
              )}
              <div>
                <p className="text-white font-semibold">
                  {result.success ? "Faturas processadas com sucesso!" : "Erro no processamento"}
                </p>
                {result.success && (
                  <p className="text-white/70 text-sm mt-1">
                    {result.faturas_extraidas} fatura(s) extraída(s) •{" "}
                    {result.analises_geradas} análise(s) gerada(s)
                  </p>
                )}
                {result.erros && result.erros.length > 0 && (
                  <div className="mt-2">
                    {result.erros.map((erro, i) => (
                      <p key={i} className="text-red-300 text-sm">
                        • {erro}
                      </p>
                    ))}
                  </div>
                )}
                {result.success && (
                  <Button
                    onClick={() => router.push("/reciee")}
                    className="mt-3 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Ver no Dashboard
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Área de Upload */}
      <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
        <CardHeader>
          <CardTitle className="text-white">Selecione os PDFs das faturas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-white/60 text-sm">
            Você pode selecionar múltiplos arquivos PDF de uma vez. O sistema extrairá
            automaticamente os dados de cada fatura.
          </p>

          {/* Drag and Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${
                dragOver
                  ? "border-[#3B64CF] bg-[#3B64CF]/10"
                  : "border-white/20 hover:border-[#3B64CF]/50 hover:bg-white/5"
              }
            `}
          >
            <FileText className="h-12 w-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">
              Arraste os PDFs aqui ou clique para selecionar
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Lista de Arquivos */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-white font-medium">
                {files.length} arquivo(s) selecionado(s):
              </p>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-[#1a2744] rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#3B64CF]" />
                    <span className="text-white text-sm">{file.name}</span>
                    <span className="text-white/40 text-xs">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="text-white/40 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading
                ? `Processando ${uploadProgress.current}/${uploadProgress.total}...`
                : "Processar Faturas"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/reciee")}
              className="border-white/20 text-white"
            >
              Cancelar
            </Button>
          </div>

          {/* Barra de progresso */}
          {uploading && uploadProgress.total > 0 && (
            <div className="w-full bg-[#1a2744] rounded-full h-2 mt-2">
              <div
                className="bg-[#3B64CF] h-2 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
