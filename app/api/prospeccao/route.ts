import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ============================================================
// Configuração de fontes de dados de CNPJ
// ============================================================

const CNPJ_ABERTO_BASE_URL = "https://cnpjaberto.com.br";
const IBGE_API_URL = "https://servicodados.ibge.gov.br/api/v1";

interface EmpresaProspeccao {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  situacao_cadastral?: string;
  cnae_principal?: string;
  cnae_principal_descricao?: string;
  porte?: string;
  capital_social?: string;
}

// ============================================================
// GET /api/prospeccao?cnae=...&uf=...&cidade=...&limite=...
// Busca empresas na API externa por CNAE/UF
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cnae = searchParams.get("cnae");
    const uf = searchParams.get("uf");
    const cidade = searchParams.get("cidade");
    const limite = Math.min(parseInt(searchParams.get("limite") || "50", 10), 100);

    if (!cnae) {
      return NextResponse.json(
        { error: "CNAE é obrigatório" },
        { status: 400 }
      );
    }

    // Limpa CNAE para formato numérico
    const cnaeLimpo = cnae.replace(/[^0-9]/g, "");

    const fonte = process.env.PROSPECCAO_FONTE || "cnpjaberto";
    let empresas: EmpresaProspeccao[] = [];

    if (fonte === "cnpjaberto") {
      if (uf) {
        // Busca em UF específica (modo antigo)
        let municipioCodigo: string | undefined;
        if (cidade && cidade.trim()) {
          municipioCodigo = await buscarCodigoIBGE(uf, cidade.trim());
          if (!municipioCodigo) {
            return NextResponse.json(
              { error: `Cidade "${cidade}" não encontrada na UF ${uf}. Verifique o nome ou deixe em branco para buscar em todo o estado.` },
              { status: 400 }
            );
          }
        }
        empresas = await buscarCnpjAbertoLeads(cnaeLimpo, uf, municipioCodigo, limite);
      } else {
        // Busca em todo o Brasil (todas as UFs em paralelo)
        empresas = await buscarCnpjAbertoTodasUfs(cnaeLimpo, limite);
      }
    } else if (fonte === "cnpjota") {
      empresas = await buscarCnpjota(cnaeLimpo, uf || "", cidade, limite);
    } else {
      return NextResponse.json({
        empresas: [],
        fonte: null,
        mensagem:
          "Nenhuma fonte de prospecção configurada. Configure PROSPECCAO_FONTE e o token correspondente no arquivo .env",
        instrucoes: {
          cnpjaberto:
            "Cadastre-se em cnpjaberto.com.br, obtenha a API Key e configure CNPJ_ABERTO_API_KEY no .env",
          cnpjota:
            "Cadastre-se em cnpjota.com.br, obtenha o token e configure CNPJOTA_TOKEN no .env",
        },
      });
    }

    return NextResponse.json({
      empresas,
      fonte,
      total: empresas.length,
    });
  } catch (err: any) {
    console.error("[Prospeccao GET] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar empresas" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/prospeccao
// Importa empresas selecionadas para o CRM
// Body: { empresas: EmpresaProspeccao[], vendedor_id?: string }
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { empresas, vendedor_id } = body;

    if (!Array.isArray(empresas) || empresas.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma empresa selecionada" },
        { status: 400 }
      );
    }

    // Verifica permissão se atribuindo a outro vendedor
    const targetVendedorId = vendedor_id || user.id;
    if (targetVendedorId !== user.id) {
      const { data: meuPerfil } = await supabase
        .from("profiles")
        .select("cargo")
        .eq("id", user.id)
        .single();

      const isDiretoria = ["diretor", "admin"].includes(meuPerfil?.cargo || "");
      if (!isDiretoria) {
        return NextResponse.json(
          { error: "Sem permissão para atribuir leads a outro vendedor" },
          { status: 403 }
        );
      }
    }

    // Busca canal de prospecção
    const { data: canalProspeccao } = await supabase
      .from("canais")
      .select("id")
      .eq("nome", "Prospecção B2B")
      .single();

    const canalId = canalProspeccao?.id || null;

    // Service client para bypassar RLS nas inserções em lote
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const resultados = {
      importados: 0,
      duplicados: 0,
      erros: 0,
      leads_ids: [] as string[],
    };

    for (const empresa of empresas) {
      try {
        // 1. Verifica duplicidade por CNPJ na tabela de leads
        const cnpjLimpo = empresa.cnpj.replace(/[^0-9]/g, "");
        const { data: existente } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("cnpj", cnpjLimpo)
          .maybeSingle();

        if (existente) {
          resultados.duplicados++;
          continue;
        }

        // 2. Cria lead na fila (vendedor_id = null, status = novo)
        const { data: lead, error: leadError } = await supabaseAdmin
          .from("leads")
          .insert({
            cnpj: cnpjLimpo,
            razao_social: empresa.razao_social || "Nome não informado",
            nome_fantasia: empresa.nome_fantasia || null,
            telefone: empresa.telefone || null,
            email: empresa.email || null,
            endereco: empresa.logradouro || null,
            numero: empresa.numero || null,
            complemento: empresa.complemento || null,
            bairro: empresa.bairro || null,
            cidade: empresa.cidade || null,
            estado: empresa.estado || null,
            cep: empresa.cep || null,
            cnae_principal: empresa.cnae_principal || null,
            cnae_descricao: empresa.cnae_principal_descricao || null,
            porte: empresa.porte || null,
            capital_social: empresa.capital_social || null,
            situacao_cadastral: empresa.situacao_cadastral || null,
            origem: "prospeccao_b2b",
            canal_origem_id: canalId,
            dados_brutos: empresa,
            status: "novo",
            vendedor_id: null,
            importado_por: user.id,
          })
          .select("id")
          .single();

        if (leadError || !lead) {
          console.error("[Prospeccao] Erro ao criar lead:", leadError);
          resultados.erros++;
          continue;
        }

        resultados.leads_ids.push(lead.id);
        resultados.importados++;
      } catch (innerErr) {
        console.error("[Prospeccao] Erro interno no loop:", innerErr);
        resultados.erros++;
      }
    }

    // 4. Registra log da importação
    await supabaseAdmin.from("prospeccao_importacoes").insert({
      importado_por: user.id,
      vendedor_id: targetVendedorId,
      cnae_filtro: body.cnae_filtro || null,
      uf_filtro: body.uf_filtro || null,
      cidade_filtro: body.cidade_filtro || null,
      quantidade_encontrada: empresas.length,
      quantidade_importada: resultados.importados,
      dados_brutos: empresas,
    });

    return NextResponse.json({
      success: true,
      resultados,
    });
  } catch (err: any) {
    console.error("[Prospeccao POST] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao importar empresas" },
      { status: 500 }
    );
  }
}

// ============================================================
// Fontes de dados
// ============================================================

async function buscarCodigoIBGE(uf: string, cidade: string): Promise<string | undefined> {
  try {
    const url = `${IBGE_API_URL}/localidades/estados/${uf}/municipios`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return undefined;

    const municipios: Array<{ id: number; nome: string }> = await res.json();
    const normalizado = cidade
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const encontrado = municipios.find((m) => {
      const nomeNormalizado = m.nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return nomeNormalizado === normalizado;
    });

    return encontrado ? String(encontrado.id) : undefined;
  } catch (err) {
    console.error("[IBGE] Erro ao buscar código:", err);
    return undefined;
  }
}

async function buscarCnpjAbertoLeads(
  cnae: string,
  uf: string,
  municipioCodigo: string | undefined,
  limite: number
): Promise<EmpresaProspeccao[]> {
  const apiKey = process.env.CNPJ_ABERTO_API_KEY;
  if (!apiKey) {
    throw new Error("CNPJ_ABERTO_API_KEY não configurada");
  }

  // Se tiver cidade, usa /api/leads (mais dados de contato, mas requer municipio_codigo)
  // Se NÃO tiver cidade, usa /api/busca-avancada (aceita UF + CNAE sem cidade)
  const temCidade = !!municipioCodigo;
  const endpoint = temCidade ? "/api/leads" : "/api/busca-avancada";

  const params: Record<string, string> = {
    uf,
    per_page: String(Math.min(limite, 50)),
  };

  if (municipioCodigo) {
    params.municipio_codigo = municipioCodigo;
  }

  if (cnae) {
    params.cnae = cnae;
  }

  // Filtros para trazer apenas empresas com dados úteis
  params.situacao = "Ativa";

  const url = `${CNPJ_ABERTO_BASE_URL}${endpoint}?${new URLSearchParams(params).toString()}`;

  const res = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
      "Accept": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CNPJ Aberto erro ${res.status}: ${text}`);
  }

  const json = await res.json();
  const dados = json.results || json.data || [];

  return dados.map((e: any) => ({
    cnpj: e.cnpj,
    razao_social: e.razao_social,
    nome_fantasia: e.nome_fantasia,
    telefone: e.telefone,
    email: e.email,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.municipio || e.cidade,
    estado: e.uf,
    cep: e.cep,
    situacao_cadastral: e.situacao_cadastral,
    cnae_principal: e.cnae || e.cnae_fiscal || e.cnae_fiscal_principal || e.cnae_principal,
    cnae_principal_descricao: e.cnae_descricao || e.cnae_fiscal_descricao || e.descricao_cnae || e.cnae_descricao_principal,
    porte: e.porte,
    capital_social: e.capital_social ? String(e.capital_social) : undefined,
  }));
}

async function buscarCnpjota(
  cnae: string,
  uf: string | null,
  cidade: string | null,
  limite: number
): Promise<EmpresaProspeccao[]> {
  const token = process.env.CNPJOTA_TOKEN;
  if (!token) {
    throw new Error("CNPJOTA_TOKEN não configurado");
  }

  const params = new URLSearchParams();
  if (uf) {
    params.set("uf", uf);
  }
  params.set("cnae_principal", cnae);
  params.set("limite", String(limite));
  params.set("situacao_cadastral", "02"); // Ativa

  if (cidade) {
    params.set("municipio", cidade);
  }

  const url = `https://api.cnpjota.com.br/api/v1/empresas/filtros?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CNPJota erro ${res.status}: ${text}`);
  }

  const json = await res.json();
  const dados = json.data || [];

  return dados.map((e: any) => ({
    cnpj: e.cnpj_completo || e.cnpj,
    razao_social: e.razao_social,
    nome_fantasia: e.nome_fantasia,
    telefone: e.telefone ? formatTelefone(e.ddd, e.telefone) : undefined,
    email: e.email,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.municipio || e.cidade,
    estado: e.uf,
    cep: e.cep,
    situacao_cadastral: e.situacao_cadastral,
    cnae_principal: e.cnae_fiscal_principal,
    cnae_principal_descricao: e.cnae_fiscal_principal_descricao,
    porte: e.porte_empresa,
    capital_social: e.capital_social,
  }));
}

const TODAS_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

async function buscarCnpjAbertoTodasUfs(
  cnae: string,
  limite: number
): Promise<EmpresaProspeccao[]> {
  const apiKey = process.env.CNPJ_ABERTO_API_KEY;
  if (!apiKey) {
    throw new Error("CNPJ_ABERTO_API_KEY não configurada");
  }

  // Busca em batches de 5 UFs por vez para evitar rate limiting
  const BATCH_SIZE = 5;
  const porUf = Math.max(2, Math.ceil(limite / TODAS_UFS.length));
  const todasEmpresas: EmpresaProspeccao[] = [];

  for (let i = 0; i < TODAS_UFS.length; i += BATCH_SIZE) {
    const batch = TODAS_UFS.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (uf) => {
      // Tenta até 3 vezes com delay crescente
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        try {
          if (tentativa > 0) {
            await new Promise((r) => setTimeout(r, tentativa * 500));
          }
          const result = await buscarCnpjAbertoLeads(cnae, uf, undefined, porUf);
          return { uf, result };
        } catch (err: any) {
          console.warn(`[Prospeccao] UF ${uf} tentativa ${tentativa + 1} falhou:`, err.message);
          if (tentativa === 2) return { uf, result: [] as EmpresaProspeccao[] };
        }
      }
      return { uf, result: [] as EmpresaProspeccao[] };
    });

    const batchResults = await Promise.all(promises);
    for (const { uf, result } of batchResults) {
      if (result.length > 0) {
        todasEmpresas.push(...result);
        console.log(`[Prospeccao] UF ${uf}: ${result.length} empresas`);
      }
    }

    // Pequeno delay entre batches
    if (i + BATCH_SIZE < TODAS_UFS.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`[Prospeccao] Total coletado: ${todasEmpresas.length} empresas`);

  // Embaralha para dar variedade geográfica nos primeiros resultados
  for (let i = todasEmpresas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todasEmpresas[i], todasEmpresas[j]] = [todasEmpresas[j], todasEmpresas[i]];
  }

  return todasEmpresas.slice(0, limite);
}

function formatTelefone(ddd?: string, numero?: string): string {
  if (!ddd || !numero) return "";
  const d = ddd.replace(/\D/g, "");
  const n = numero.replace(/\D/g, "");
  if (n.length === 8) return `(${d}) ${n.slice(0, 4)}-${n.slice(4)}`;
  if (n.length === 9) return `(${d}) ${n.slice(0, 5)}-${n.slice(5)}`;
  return `(${d}) ${n}`;
}
