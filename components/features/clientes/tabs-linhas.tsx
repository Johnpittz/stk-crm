"use client";
/**
 * 12/10 — abas NOVAS da pasta do cliente (Eletroposto, Sigma Solar,
 * BESS, Gestão de Fatura). Montagem GENÉRICA a partir do catálogo
 * `LINHAS_PASTA`: mesmo visual das abas existentes (cards escuros),
 * validação/normalização pela lib pura antes de salvar.
 *
 * - TabLinhaSimples: 1 registro por cliente (edita/exclui).
 * - TabGestaoFatura: lista de faturas (adiciona/edita/exclui).
 * A página (cliente/[id]) faz o supabase e repassa onSalvar/onExcluir.
 */
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import {
  buscarLinha,
  normalizarLinha,
  validarLinha,
  ordenarFaturas,
  formatarValor,
  formatarCompetencia,
  type LinhaId,
  type LinhaRegistro,
} from "@/lib/clientes/linhas";

interface PropsSimples {
  linha: LinhaId;
  registros: LinhaRegistro[];
  onSalvar: (dados: Record<string, unknown>, id?: string) => void | Promise<void>;
  onExcluir: (id: string) => void | Promise<void>;
}

interface PropsFatura {
  registros: LinhaRegistro[];
  onSalvar: (dados: Record<string, unknown>, id?: string) => void | Promise<void>;
  onExcluir: (id: string) => void | Promise<void>;
}

const INPUT =
  "w-full h-9 px-3 rounded-lg border border-white/10 bg-[#0f1b30] text-white text-sm " +
  "focus:outline-none focus:border-[#3B64CF]/60 placeholder:text-white/30";
const BTN =
  "flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg font-medium transition-colors";

function valorVisto(tipo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (tipo === "moeda") return formatarValor(valor);
  if (tipo === "mes") return formatarCompetencia(valor);
  return String(valor);
}

/** Formulário dos campos da linha (catálogo → inputs). */
function FormLinha({
  linha,
  form,
  setForm,
  erros,
  onSalvar,
  onCancelar,
}: {
  linha: LinhaId;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  erros: string[];
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const cfg = buscarLinha(linha);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cfg.campos.map((campo) => {
          const id = `${linha}-${campo.nome}`;
          return (
            <div key={campo.nome} className={campo.tipo === "texto" ? "sm:col-span-2" : ""}>
              <label htmlFor={id} className="block text-xs text-white/50 mb-1">
                {campo.label}
              </label>
              {campo.tipo === "select" ? (
                <select
                  id={id}
                  className={INPUT}
                  value={form[campo.nome] ?? ""}
                  onChange={(e) => setForm({ ...form, [campo.nome]: e.target.value })}
                >
                  <option value="">—</option>
                  {(campo.opcoes ?? []).map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type={campo.tipo === "mes" ? "month" : campo.tipo === "data" ? "date" : "text"}
                  className={INPUT}
                  placeholder={campo.tipo === "moeda" ? "R$ 0,00" : undefined}
                  value={form[campo.nome] ?? ""}
                  onChange={(e) => setForm({ ...form, [campo.nome]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>

      {erros.length > 0 && (
        <ul className="space-y-1" data-testid="erros">
          {erros.map((e) => (
            <li key={e} className="text-xs text-red-400">
              ⚠ {e}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSalvar}
          className={`${BTN} bg-[#3B64CF] text-white hover:bg-[#3357b8]`}
        >
          <Save className="h-3.5 w-3.5" /> Salvar
        </button>
        <button
          onClick={onCancelar}
          className={`${BTN} border border-white/10 text-white/60 hover:text-white`}
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}

/** ABA com 1 registro por cliente (Eletroposto / Sigma Solar / BESS). */
export function TabLinhaSimples({ linha, registros, onSalvar, onExcluir }: PropsSimples) {
  const cfg = buscarLinha(linha);
  const registro = registros[0];
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<string[]>([]);

  function abrirAdicionar() {
    setForm({});
    setErros([]);
    setEditando(true);
  }

  function abrirEditar() {
    const inicial: Record<string, string> = {};
    for (const campo of cfg.campos) {
      const v = registro?.dados?.[campo.nome];
      inicial[campo.nome] = v === null || v === undefined ? "" : String(v);
    }
    setForm(inicial);
    setErros([]);
    setEditando(true);
  }

  async function salvar() {
    const dados = normalizarLinha(linha, form);
    const errs = validarLinha(linha, dados);
    if (errs.length > 0) {
      setErros(errs);
      return;
    }
    await onSalvar(dados, registro?.id);
    setEditando(false);
    setErros([]);
  }

  if (editando) {
    return (
      <FormLinha
        linha={linha}
        form={form}
        setForm={setForm}
        erros={erros}
        onSalvar={salvar}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  if (!registro) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-white/40">
          Nenhum registro de {cfg.label} ainda. {cfg.descricao}
        </p>
        <button
          onClick={abrirAdicionar}
          className={`${BTN} bg-[#3B64CF] text-white hover:bg-[#3357b8]`}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cfg.campos.map((campo) => (
          <div
            key={campo.nome}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
              {campo.label}
            </p>
            <p className="text-sm text-white break-words">
              {valorVisto(campo.tipo, registro.dados?.[campo.nome])}
            </p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={abrirEditar}
          className={`${BTN} border border-white/10 text-white/70 hover:text-white`}
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={() => onExcluir(registro.id)}
          className={`${BTN} border border-white/10 text-red-400/70 hover:text-red-400`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </div>
    </div>
  );
}

/** ABA Gestão de Fatura: lista mensal com adicionar/editar/excluir. */
export function TabGestaoFatura({ registros, onSalvar, onExcluir }: PropsFatura) {
  const linha: LinhaId = "gestao_fatura";
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const ordenadas = ordenarFaturas(registros);

  function abrirAdicionar() {
    setForm({});
    setErros([]);
    setEditId(undefined);
    setEditando(true);
  }

  function abrirEditar(reg: LinhaRegistro) {
    const inicial: Record<string, string> = {};
    for (const campo of buscarLinha(linha).campos) {
      const v = reg.dados?.[campo.nome];
      inicial[campo.nome] = v === null || v === undefined ? "" : String(v);
    }
    setForm(inicial);
    setErros([]);
    setEditId(reg.id);
    setEditando(true);
  }

  async function salvar() {
    const dados = normalizarLinha(linha, form);
    const errs = validarLinha(linha, dados);
    if (errs.length > 0) {
      setErros(errs);
      return;
    }
    await onSalvar(dados, editId);
    setEditando(false);
    setErros([]);
  }

  if (editando) {
    return (
      <FormLinha
        linha={linha}
        form={form}
        setForm={setForm}
        erros={erros}
        onSalvar={salvar}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {ordenadas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-white/40">
            Nenhuma fatura registrada ainda. Lance a competência, o valor e o consumo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordenadas.map((reg) => (
            <div
              key={reg.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="text-sm font-medium text-white">
                {formatarCompetencia(reg.dados?.competencia)}
              </span>
              <span className="text-sm text-white/80">{formatarValor(reg.dados?.valor)}</span>
              {reg.dados?.consumo_kwh !== null &&
                reg.dados?.consumo_kwh !== undefined && (
                  <span className="text-xs text-white/50">
                    {String(reg.dados.consumo_kwh)} kWh
                  </span>
                )}
              {Boolean(reg.dados?.situacao) && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {String(reg.dados.situacao)}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => abrirEditar(reg)}
                  className={`${BTN} border border-white/10 text-white/70 hover:text-white`}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => onExcluir(reg.id)}
                  className={`${BTN} border border-white/10 text-red-400/70 hover:text-red-400`}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={abrirAdicionar}
        className={`${BTN} bg-[#3B64CF] text-white hover:bg-[#3357b8]`}
      >
        <Plus className="h-4 w-4" /> Adicionar fatura
      </button>
    </div>
  );
}
