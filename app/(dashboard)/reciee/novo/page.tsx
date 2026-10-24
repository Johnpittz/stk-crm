"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Cadastrar com fatura — caminho curto do RECIEE.
 * O cliente não precisa de formulário: sobem os PDFs e o cadastro nasce
 * da própria conta (titular, CNPJ, UC, concessionária, grupo).
 */
export default function CadastrarComFaturaPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [arquivos, setArquivos] = useState<FileList | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [errosArquivos, setErrosArquivos] = useState<string[]>([]);
  const [ok, setOk] = useState<null | {
    clienteId: string;
    nome: string;
    uc: string;
    distribuidora: string;
    faturas: number;
    proximo: string;
  }>(null);

  async function enviar() {
    setErro(null);
    setAvisos([]);
    setErrosArquivos([]);
    if (!arquivos || arquivos.length === 0) {
      setErro("Selecione ao menos um PDF de fatura.");
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(arquivos)) fd.append("faturas", f);
      if (nome.trim()) fd.append("nome", nome.trim());

      const r = await fetch("/api/reciee/clientes/criar-com-fatura", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j?.error || "Não consegui cadastrar.");
        setErrosArquivos(Array.isArray(j?.erros) ? j.erros : []);
        return;
      }
      setAvisos(Array.isArray(j.avisos) ? j.avisos : []);
      setErrosArquivos(Array.isArray(j.erros) ? j.erros : []);
      setOk({
        clienteId: j.clienteId,
        nome: j.nome,
        uc: j.uc,
        distribuidora: j.distribuidora,
        faturas: j.faturas,
        proximo: j.proximo,
      });
    } catch {
      setErro("Falha na comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-white mb-2">
          Cliente cadastrado pela fatura
        </h1>
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-white/80 space-y-1">
          <p>
            <span className="text-white/50">Nome:</span> {ok.nome}
          </p>
          <p>
            <span className="text-white/50">UC:</span> {ok.uc || "—"}
          </p>
          <p>
            <span className="text-white/50">Concessionária:</span>{" "}
            {ok.distribuidora || "—"}
          </p>
          <p>
            <span className="text-white/50">Faturas gravadas:</span> {ok.faturas}
          </p>
        </div>

        {avisos.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            <p className="font-medium mb-1">Completar na ficha:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {errosArquivos.length > 0 && (
          <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            <ul className="list-disc pl-5">
              {errosArquivos.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            className="bg-[#3B64CF] hover:bg-[#2d4fa0] text-white"
            onClick={() => router.push(ok.proximo)}
          >
            Abrir pasta do cliente
          </Button>
          <Button
            variant="outline"
            className="border-white/20 text-white"
            onClick={() => router.push("/reciee")}
          >
            Ir para RECIEE
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-1">
        Cadastrar com fatura
      </h1>
      <p className="text-sm text-white/60 mb-6">
        Suba os PDFs da conta: o cliente é criado a partir do que a fatura diz
        (titular, CNPJ, UC, concessionária e grupo). O que a conta não traz,
        você completa depois na ficha.
      </p>

      <label className="block text-sm text-white/70 mb-1">
        Nome do cliente <span className="text-white/40">(opcional)</span>
      </label>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Só preencha se a fatura não mostrar o titular"
        className="mb-4 bg-white/5 border-white/15 text-white"
      />

      <label className="block text-sm text-white/70 mb-1">Faturas (PDF)</label>
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => setArquivos(e.target.files)}
        className="w-full text-sm text-white/70 file:mr-4 file:rounded-md file:border-0 file:bg-[#3B64CF] file:px-4 file:py-2 file:text-white hover:file:bg-[#2d4fa0]"
      />

      {erro && (
        <p className="mt-4 text-sm text-red-300">{erro}</p>
      )}

      <div className="mt-6 flex gap-2">
        <Button
          onClick={enviar}
          disabled={enviando}
          className="bg-[#3B64CF] hover:bg-[#2d4fa0] text-white"
        >
          {enviando ? "Cadastrando…" : "Cadastrar com fatura"}
        </Button>
        <Link href="/reciee">
          <Button variant="outline" className="border-white/20 text-white">
            Cancelar
          </Button>
        </Link>
      </div>
    </div>
  );
}
