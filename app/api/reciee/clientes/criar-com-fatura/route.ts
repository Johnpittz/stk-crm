import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analisarFaturaTexto } from "@/lib/ia/analisar-fatura";
import { montarClienteDeFatura } from "@/lib/reciee/cadastro";
import {
  extrairGrupoA,
  extrairGrupoB,
  parsePdf,
} from "@/lib/reciee/extrair-pdf";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/reciee/clientes/criar-com-fatura
 *
 * "Cadastrar com fatura": sobe os PDFs primeiro e o cliente nasce deles.
 * 1) a IA lê a primeira fatura → titular, CNPJ, UC, concessionária, grupo;
 * 2) cria `clientes_reciee` (o que a fatura não diz fica em branco, com aviso);
 * 3) grava todas as faturas com o extrator determinístico já em produção.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("faturas").filter((f): f is File => f instanceof File);
    const nomeInformado = String(formData.get("nome") || "").trim() || null;

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // --- 1. ler o PDF da identidade do cliente
    let textoPrimeira = "";
    const erros: string[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        erros.push(`${file.name}: só é aceito PDF`);
        continue;
      }
      try {
        const texto = await parsePdf(Buffer.from(await file.arrayBuffer()));
        if (texto.trim() && !textoPrimeira) textoPrimeira = texto;
      } catch (e) {
        erros.push(`${file.name}: ${(e as Error).message}`);
      }
    }

    if (!textoPrimeira) {
      return NextResponse.json(
        { error: "Nenhum PDF legível enviado", erros },
        { status: 422 }
      );
    }

    const resumo = await analisarFaturaTexto(textoPrimeira);
    const { payload, avisos } = montarClienteDeFatura({ resumo, nomeInformado });

    // --- 2. criar o cliente
    const supabase = getSupabase();
    const { data: cliente, error: erroInsert } = await supabase
      .from("clientes_reciee")
      .insert({
        nome: payload.nome,
        cpf_cnpj: payload.cpf_cnpj,
        uc: payload.uc,
        estado: payload.estado,
        distribuidora: payload.distribuidora,
        subgrupo: payload.subgrupo,
        modalidade: payload.modalidade,
        classe: payload.classe,
        tensao: payload.tensao,
        grupo: payload.grupo,
        gd: payload.gd,
      })
      .select()
      .single();

    if (erroInsert || !cliente) {
      console.error("[criar-com-fatura] insert cliente:", erroInsert);
      return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
    }

    // --- 3. gravar as faturas com o extrator determinístico
    const faturasSalvas: Record<string, unknown>[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const texto = await parsePdf(Buffer.from(await file.arrayBuffer()));
        const fatura =
          payload.grupo === "A" ? extrairGrupoA(texto, file.name) : extrairGrupoB(texto, file.name);
        if (!fatura) {
          erros.push(`${file.name}: não consegui extrair os valores`);
          continue;
        }
        const { data: salva } = await supabase
          .from("faturas_reciee")
          .insert({
            cliente_id: cliente.id,
            competencia: fatura.periodo || "",
            consumo_kwh: fatura.consumo_kwh || 0,
            tarifa_aplicada: fatura.tarifa_aplicada || 0,
            valor_consumo: fatura.valor_consumo || 0,
            icms_valor: fatura.icms_valor || 0,
            icms_aliquota: fatura.icms_aliquota || 0,
            pis_valor: fatura.pis_valor || 0,
            cofins_valor: fatura.cofins_valor || 0,
            bandeira: fatura.bandeira || "Verde",
            cip: fatura.cip || 0,
            valor_total: fatura.valor_total || 0,
          })
          .select()
          .single();
        if (salva) faturasSalvas.push(salva);
      } catch (e) {
        erros.push(`${file.name}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      clienteId: cliente.id,
      nome: payload.nome,
      uc: payload.uc,
      distribuidora: payload.distribuidora,
      grupo: payload.grupo,
      gd: payload.gd,
      faturas: faturasSalvas.length,
      avisos,
      erros,
      proximo: `/reciee/${cliente.id}`,
    });
  } catch (e) {
    console.error("[criar-com-fatura]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
