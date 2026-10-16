import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extrairLeads } from '@/lib/leads/extrair-leads';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const EXTENSOES_OK = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.xls'];

/** ITEM 8 — texto do arquivo (PDF, Word, planilha ou texto puro). */
async function textoDoArquivo(file: File): Promise<string> {
  const nome = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (nome.endsWith('.pdf')) {
    // mesmo caminho da IA de conta (pdf2json externo, já usado em produção)
    const { extrairTextoPdf } = await import('@/lib/ia/pdf-texto');
    return (await extrairTextoPdf(buffer)) || '';
  }
  if (nome.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const resultado = await mammoth.extractRawText({ buffer });
    return resultado?.value || '';
  }
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(ws);
  }
  return buffer.toString('utf-8'); // .txt / .csv
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const arquivo = formData.get('arquivo');

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { success: false, erro: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }
    const extensao = '.' + arquivo.name.split('.').pop()?.toLowerCase();
    if (!EXTENSOES_OK.includes(extensao)) {
      return NextResponse.json(
        { success: false, erro: 'Formato não suportado (use PDF, DOCX, CSV, TXT ou planilha)' },
        { status: 400 }
      );
    }

    const texto = await textoDoArquivo(arquivo);
    const leads = extrairLeads(texto);

    if (leads.length === 0) {
      return NextResponse.json({
        success: false,
        erro: 'Nenhum telefone encontrado no arquivo',
        importados: 0,
      });
    }

    const linhas = leads.map(lead => ({
      nome: lead.nome || 'Lead importado',
      telefone: lead.telefone,
      origem: 'outro',
      status: 'novo',
      notas: `Importado de ${arquivo.name}`,
    }));

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('leads_marketing')
      .insert(linhas)
      .select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      importados: data?.length ?? leads.length,
      ignorados: Math.max(0, texto.split(/\r?\n/).filter(l => l.trim()).length - leads.length),
    });
  } catch (error) {
    console.error('[leads/importar]', error);
    return NextResponse.json(
      { success: false, erro: 'Erro ao importar a lista' },
      { status: 500 }
    );
  }
}
