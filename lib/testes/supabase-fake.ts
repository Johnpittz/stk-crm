/**
 * Fake de Supabase em memória — usado nos testes da Fase 6 (C4) para as rotas
 * de proposta e de oportunidade.
 *
 * Cobre o que essas rotas usam: `auth.getUser`, builder de query
 * (select/eq/in/order/limit/insert/upsert/single/maybeSingle) e o Storage
 * (`createBucket` + `upload`/`download`). Sem rede, sem credencial.
 *
 * Uso no teste:
 *   vi.mock("@/lib/supabase/server", async () => {
 *     const { cenario } = await import("@/lib/testes/supabase-fake");
 *     return { createClient: async () => ({ ... }) };
 *   });
 * e depois `import { cenario } from "@/lib/testes/supabase-fake"` normalmente.
 */

type Registro = Record<string, any>;

export interface CenarioFake {
  tabelas: Record<string, Registro[]>;
  estado: {
    usuario: Registro | null;
    seq: number;
    /** simula "tabela não existe" (migration não aplicada) */
    tabelaQuebrada: string | null;
    /** simula "não consegui criar o bucket" */
    bucketIndisponivel: boolean;
    buckets: Set<string>;
    arquivos: Map<string, Uint8Array>;
    uploads: string[];
  };
  builder: (tabela: string) => any;
  storage: {
    createBucket: (id: string) => Promise<{ data: any; error: any }>;
    from: (bucket: string) => {
      upload: (
        path: string,
        conteudo: any,
        opts?: any
      ) => Promise<{ data: any; error: any }>;
      download: (path: string) => Promise<{ data: any; error: any }>;
    };
  };
  limpar: () => void;
}

function criarCenario(): CenarioFake {
  const tabelas: Record<string, Registro[]> = {
    profiles: [],
    clientes: [],
    oportunidades: [],
    oportunidade_historico: [],
    fila_propostas_axs: [],
    propostas: [],
  };

  const estado: CenarioFake["estado"] = {
    usuario: null,
    seq: 0,
    tabelaQuebrada: null,
    bucketIndisponivel: false,
    buckets: new Set<string>(["propostas"]),
    arquivos: new Map<string, Uint8Array>(),
    uploads: [],
  };

  function builder(tabela: string) {
    const est: any = {
      filtros: [] as Array<{ tipo: string; campo: string; valor: any }>,
      ordem: null as null | { campo: string; asc: boolean },
      limite: null as number | null,
      mutacao: null as null | {
        tipo: string;
        payload: Registro;
        onConflict?: string;
      },
    };

    const erroTabela = () =>
      estado.tabelaQuebrada === tabela
        ? { message: `relation "public.${tabela}" does not exist`, code: "42P01" }
        : null;

    const filtrar = (): Registro[] => {
      let linhas = [...(tabelas[tabela] ?? [])];
      for (const f of est.filtros) {
        linhas = linhas.filter((l) => {
          if (f.tipo === "eq") return l[f.campo] === f.valor;
          if (f.tipo === "in") return (f.valor as any[]).includes(l[f.campo]);
          if (f.tipo === "gte")
            return l[f.campo] != null && l[f.campo] >= f.valor;
          return false;
        });
      }
      return linhas;
    };

    const agora = () => "2026-09-27T12:00:00.000Z";

    // PostgREST devolve SNAPSHOT (JSON), não a linha viva: sem isto, um
    // update no meio do teste reescreve o objeto que a rota leu antes.
    const copia = (registro: Registro) => structuredClone(registro);

    const executar = async (): Promise<Registro | Registro[] | null> => {
      if (erroTabela()) return null;

      if (est.mutacao?.tipo === "insert") {
        const novo: Registro = {
          id: `id-${++estado.seq}`,
          created_at: agora(),
          updated_at: agora(),
          ...est.mutacao.payload,
        };
        (tabelas[tabela] ??= []).push(novo);
        return copia(novo);
      }

      const linhas = filtrar();

      if (est.mutacao?.tipo === "update") {
        for (const linha of linhas) {
          Object.assign(linha, est.mutacao.payload, { updated_at: agora() });
        }
        return linhas[0] ? copia(linhas[0]) : null;
      }

      if (est.mutacao?.tipo === "upsert") {
        const payload = est.mutacao.payload;
        const chave = est.mutacao.onConflict;
        const lista = (tabelas[tabela] ??= []);
        const existente = chave
          ? lista.find((l) => l[chave] != null && l[chave] === payload[chave])
          : linhas[0];
        if (existente) {
          Object.assign(existente, payload, { updated_at: agora() });
          return copia(existente);
        }
        const novo: Registro = {
          id: `id-${++estado.seq}`,
          created_at: agora(),
          updated_at: agora(),
          ...payload,
        };
        lista.push(novo);
        return copia(novo);
      }

      let ordenadas = linhas;
      if (est.ordem) {
        const { campo, asc } = est.ordem;
        ordenadas.sort(
          (a, b) =>
            (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (asc ? 1 : -1)
        );
      }
      if (est.limite != null) ordenadas = ordenadas.slice(0, est.limite);
      return ordenadas.map(copia);
    };

    const b: any = {
      select: () => b,
      eq: (campo: string, valor: any) => {
        est.filtros.push({ tipo: "eq", campo, valor });
        return b;
      },
      in: (campo: string, valor: any[]) => {
        est.filtros.push({ tipo: "in", campo, valor });
        return b;
      },
      gte: (campo: string, valor: any) => {
        est.filtros.push({ tipo: "gte", campo, valor });
        return b;
      },
      order: (campo: string, opts?: { ascending?: boolean }) => {
        est.ordem = { campo, asc: opts?.ascending !== false };
        return b;
      },
      limit: (n: number) => {
        est.limite = n;
        return b;
      },
      insert: (payload: Registro) => {
        est.mutacao = { tipo: "insert", payload };
        return b;
      },
      update: (payload: Registro) => {
        est.mutacao = { tipo: "update", payload };
        return b;
      },
      upsert: (payload: Registro, opts?: { onConflict?: string }) => {
        est.mutacao = { tipo: "upsert", payload, onConflict: opts?.onConflict };
        return b;
      },
      single: async () => {
        const erro = erroTabela();
        if (erro) return { data: null, error: erro };
        const linha = await executar();
        const registro = Array.isArray(linha) ? linha[0] : linha;
        return registro
          ? { data: registro, error: null }
          : { data: null, error: { message: "0 rows", code: "PGRST116" } };
      },
      maybeSingle: async () => {
        const erro = erroTabela();
        if (erro) return { data: null, error: erro };
        const linha = await executar();
        const registro = Array.isArray(linha) ? linha[0] ?? null : linha;
        return { data: registro, error: null };
      },
      then: (res: any, rej: any) =>
        executar()
          .then((saida) => {
            const erro = erroTabela();
            res(erro ? { data: null, error: erro } : { data: saida, error: null });
          })
          .catch(rej),
    };
    return b;
  }

  const storage: CenarioFake["storage"] = {
    createBucket: async (id: string) => {
      if (estado.bucketIndisponivel) {
        return { data: null, error: { message: "permission denied for bucket" } };
      }
      if (estado.buckets.has(id)) {
        return { data: null, error: { message: "The resource already exists" } };
      }
      estado.buckets.add(id);
      return { data: { name: id }, error: null };
    },
    from: (bucket: string) => ({
      upload: async (path: string, conteudo: any) => {
        if (!estado.buckets.has(bucket)) {
          return { data: null, error: { message: `Bucket ${bucket} not found` } };
        }
        estado.uploads.push(`${bucket}/${path}`);
        estado.arquivos.set(path, new Uint8Array(conteudo));
        return { data: { path }, error: null };
      },
      download: async (path: string) => {
        const arquivo = estado.arquivos.get(path);
        return arquivo
          ? { data: arquivo, error: null }
          : { data: null, error: { message: "Object not found" } };
      },
    }),
  };

  const limpar = () => {
    for (const k of Object.keys(tabelas)) tabelas[k] = [];
    estado.usuario = null;
    estado.seq = 0;
    estado.tabelaQuebrada = null;
    estado.bucketIndisponivel = false;
    estado.buckets = new Set<string>(["propostas"]);
    estado.arquivos = new Map();
    estado.uploads = [];
  };

  return { tabelas, estado, builder, storage, limpar };
}

/** Singleton por arquivo de teste (cada teste roda isolado). */
export const cenario: CenarioFake = criarCenario();
