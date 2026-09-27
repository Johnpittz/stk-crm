/**
 * Fase 6 / C4 — serviço que gera o documento de proposta.
 *
 * Duas origens usam o MESMO código:
 *   • POST /api/propostas            → botão "Gerar/Baixar proposta"
 *   • PATCH /api/oportunidades       → gatilho automático quando a etapa
 *                                      vira `contrato_enviado` (decisão D8)
 *
 * Fonte dos dados: payload da fila AXS (C3) → cadastro do cliente →
 * oportunidade (única fonte de valores). Conteúdo validado em
 * `lib/propostas/documento.ts`; PDF em `lib/propostas/pdf.ts`.
 */
import {
  montarDadosDocumento,
  validarDadosDocumento,
  ETAPA_GERA_PROPOSTA_AUTOMATICA,
} from "./documento";
import { gerarPdfProposta } from "./pdf";

export { ETAPA_GERA_PROPOSTA_AUTOMATICA };

/** Bucket privado criado pela migration 093_propostas_documento.sql. */
export const BUCKET_PROPOSTAS = "propostas";
export const MIGRACAO_PROPOSTAS = "093_propostas_documento.sql";

const CARGOS_GESTOR = ["diretor", "admin", "gerente_comercial"];

export function ehGestor(cargo: string | null | undefined): boolean {
  return CARGOS_GESTOR.includes(cargo || "");
}

/** Cargo do usuário logado (profiles). */
export async function cargoDo(
  supabase: any,
  usuarioId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", usuarioId)
    .maybeSingle();
  return data?.cargo ?? null;
}

export interface ResultadoGeracao {
  /** 201 gerou · 400 dados incompletos · 404 não achou · 403 sem permissão · 500 infra */
  status: number;
  proposta?: Record<string, any>;
  erros?: string[];
  error?: string;
}

/**
 * Gera o PDF, salva no Storage e grava/atualiza o registro (upsert por
 * oportunidade). Nunca lança: devolve o status para a rota responder.
 */
export async function gerarDocumentoProposta({
  supabase,
  admin,
  usuario,
  oportunidadeId,
  agora,
}: {
  supabase: any;
  admin: any;
  usuario: { id: string };
  oportunidadeId: string;
  agora?: Date;
}): Promise<ResultadoGeracao> {
  const { data: oportunidade } = await admin
    .from("oportunidades")
    .select("*")
    .eq("id", oportunidadeId)
    .maybeSingle();

  if (!oportunidade) {
    return { status: 404, error: "Oportunidade não encontrada" };
  }

  const cargo = await cargoDo(supabase, usuario.id);
  if (oportunidade.vendedor_id !== usuario.id && !ehGestor(cargo)) {
    return { status: 403, error: "Você não tem permissão para gerar esta proposta" };
  }

  if (!oportunidade.cliente_id) {
    return {
      status: 400,
      erros: ["Vincule um cliente à oportunidade antes de gerar a proposta"],
    };
  }

  const { data: cliente } = await admin
    .from("clientes")
    .select("*")
    .eq("id", oportunidade.cliente_id)
    .maybeSingle();

  if (!cliente) {
    return {
      status: 400,
      erros: ["Cliente da oportunidade não encontrado no cadastro"],
    };
  }

  // última proposta cadastrada na AXS (C3) — fonte preferida dos dados
  const { data: itemFila } = await admin
    .from("fila_propostas_axs")
    .select("payload")
    .eq("cliente_id", oportunidade.cliente_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dados = montarDadosDocumento({
    cliente,
    oportunidade,
    payload: itemFila?.payload ?? null,
    agora: agora ?? new Date(),
  });

  const erros = validarDadosDocumento(dados);
  if (erros.length) {
    return { status: 400, erros };
  }

  let pdf: Uint8Array;
  try {
    pdf = await gerarPdfProposta(dados);
  } catch (erro) {
    console.error("[propostas] falha ao montar o PDF:", erro);
    return { status: 500, error: "Não consegui montar o PDF da proposta" };
  }

  // bucket: a migration cria; se faltar, tenta criar para o botão não morrer
  const { error: bucketError } = await admin.storage.createBucket(
    BUCKET_PROPOSTAS,
    {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    }
  );
  if (bucketError && !/already exists/i.test(bucketError.message || "")) {
    return {
      status: 500,
      error: `Não consegui criar o bucket "${BUCKET_PROPOSTAS}" no Storage (${bucketError.message}) — aplique a migration ${MIGRACAO_PROPOSTAS} no SQL Editor do Supabase.`,
    };
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET_PROPOSTAS)
    .upload(dados.arquivo_path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[propostas] falha no upload:", uploadError);
    return {
      status: 500,
      error: `Não consegui salvar o PDF no Storage (${uploadError.message}) — aplique a migration ${MIGRACAO_PROPOSTAS} se ela ainda não foi executada.`,
    };
  }

  const registro = {
    cliente_id: dados.cliente_id,
    oportunidade_id: oportunidadeId,
    vendedor_id: oportunidade.vendedor_id ?? usuario.id,
    numero: dados.numero,
    titulo: dados.titulo,
    dados,
    arquivo_path: dados.arquivo_path,
    arquivo_nome: dados.arquivo_nome,
    tamanho_bytes: pdf.byteLength,
    data_emissao: dados.data_emissao,
    validade: dados.validade,
    gerado_por: usuario.id,
  };

  const { data: salvo, error: erroRegistro } = await admin
    .from("propostas")
    .upsert(registro, { onConflict: "oportunidade_id" })
    .select()
    .single();

  if (erroRegistro) {
    console.error("[propostas] falha ao gravar registro:", erroRegistro);
    return {
      status: 500,
      error: `Não consegui registrar a proposta (${erroRegistro.message}) — aplique a migration ${MIGRACAO_PROPOSTAS} no SQL Editor do Supabase.`,
    };
  }

  return { status: 201, proposta: salvo };
}
