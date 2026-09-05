import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lazy-load pdf-parse to avoid cold-start issues
async function parsePdf(buffer: Buffer): Promise<string> {
  // Use require for CJS module
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse");
  const PDFParse = pdfParse.PDFParse || pdfParse.default || pdfParse;
  const data = await PDFParse(buffer);
  return data.text || "";
}

// ==================== FUNÇÕES DE EXTRAÇÃO ====================

function parseNumber(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function extrairGrupoB(text: string, filename: string): Record<string, any> | null {
  if (!text.includes("CONSUMO")) return null;

  const fatura: Record<string, any> = { arquivo: filename };

  // Período
  const periodoMatches = text.match(/[A-Z]{3}\/\d{4}/g);
  if (periodoMatches) {
    fatura.periodo = periodoMatches[periodoMatches.length - 1];
  }

  const lines = text.split("\n").map((ln) => ln.trim()).filter(Boolean);
  const textJoined = lines.join(" ");

  // CONSUMO kWh
  const consumoLine = lines.find(
    (line) => line.includes("CONSUMO") && line.includes("kWh") && line.includes("%")
  );

  if (consumoLine) {
    const m = consumoLine.match(
      /kWh\s+([\d.,]+)\s+[\d.,]+\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)\s+([\d.,]+)/
    );
    if (m) {
      fatura.consumo_kwh = parseNumber(m[1]);
      fatura.valor_consumo = parseNumber(m[2]);
      fatura.bandeira_valor = parseNumber(m[3]);
      fatura.icms_base = parseNumber(m[4]);
      fatura.icms_aliquota = parseNumber(m[5]);
      fatura.icms_valor = parseNumber(m[6]);
      fatura.tarifa_aplicada = parseNumber(m[7]);
    }
  }

  // PIS/PASEP
  for (const line of lines) {
    const mPis = line.match(/^PIS\/PASEP\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
    if (mPis) {
      fatura.pis_base = parseNumber(mPis[1]);
      fatura.pis_aliquota = parseNumber(mPis[2]);
      fatura.pis_valor = parseNumber(mPis[3]);
      break;
    }
  }

  // COFINS
  const cofinsMatch = textJoined.match(/COFINS\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
  if (cofinsMatch) {
    fatura.cofins_base = parseNumber(cofinsMatch[1]);
    fatura.cofins_aliquota = parseNumber(cofinsMatch[2]);
    fatura.cofins_valor = parseNumber(cofinsMatch[3]);
  }

  // ICMS (se não encontrado na linha de CONSUMO)
  if (!fatura.icms_base) {
    const icmsMatch = textJoined.match(/ICMS\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
    if (icmsMatch) {
      fatura.icms_base = parseNumber(icmsMatch[1]);
      fatura.icms_aliquota = parseNumber(icmsMatch[2]);
      fatura.icms_valor = parseNumber(icmsMatch[3]);
    }
  }

  // CIP
  const cipMatch = textJoined.match(/CONTRIB\.\s*ILUM\.\s*PÚBLICA.*?([\d,.]+)/);
  if (cipMatch) {
    fatura.cip = parseNumber(cipMatch[1]);
  }

  // Valor total
  const totalMatch = textJoined.match(/R\$[\*]*([\d.]+,\d{2})\s*\d{2}\/\d{2}\/\d{4}/);
  if (totalMatch) {
    fatura.valor_total = parseNumber(totalMatch[1]);
  }

  // Bandeira
  if (text.includes("VERDE")) fatura.bandeira = "Verde";
  else if (text.includes("AMARELA")) fatura.bandeira = "Amarela";
  else if (text.includes("VERMELHA")) fatura.bandeira = "Vermelha";
  else fatura.bandeira = "Verde";

  // VRC
  const vrcMatch = text.match(/VRC = R\$ ([\d,.]+)/);
  if (vrcMatch) {
    fatura.vrc = parseNumber(vrcMatch[1]);
  }

  // Leitura mínima
  fatura.leitura_minimo = text.includes("MÍNIMO");

  return fatura;
}

function extrairGrupoA(text: string, filename: string): Record<string, any> | null {
  if (!text.includes("CONSUMO") && !text.includes("DEMANDA")) return null;

  const fatura: Record<string, any> = { arquivo: filename };

  // Período
  const periodoMatches = text.match(/[A-Z]{3}\/\d{4}/g);
  if (periodoMatches) {
    fatura.periodo = periodoMatches[periodoMatches.length - 1];
  }

  const lines = text.split("\n").map((ln) => ln.trim()).filter(Boolean);
  const textJoined = lines.join(" ");

  // Consumo
  const consumoMatch = textJoined.match(/CONSUMO\s+([\d.,]+)\s*kWh/);
  if (consumoMatch) {
    fatura.consumo_kwh = parseNumber(consumoMatch[1]);
  }

  // Demanda
  const demandaMatch = textJoined.match(/DEMANDA\s+([\d.,]+)\s*kW/);
  if (demandaMatch) {
    fatura.demanda_kw = parseNumber(demandaMatch[1]);
  }

  // Tarifa
  const tarifaMatch = textJoined.match(/TARIFA\s+([\d.,]+)/);
  if (tarifaMatch) {
    fatura.tarifa_aplicada = parseNumber(tarifaMatch[1]);
  }

  // ICMS
  const icmsMatch = textJoined.match(/ICMS\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
  if (icmsMatch) {
    fatura.icms_base = parseNumber(icmsMatch[1]);
    fatura.icms_aliquota = parseNumber(icmsMatch[2]);
    fatura.icms_valor = parseNumber(icmsMatch[3]);
  }

  // PIS
  const pisMatch = textJoined.match(/PIS\/PASEP\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
  if (pisMatch) {
    fatura.pis_valor = parseNumber(pisMatch[3]);
  }

  // COFINS
  const cofinsMatch = textJoined.match(/COFINS\s+([\d.,]+)\s+([\d.,]+)%\s+([\d.,]+)/);
  if (cofinsMatch) {
    fatura.cofins_valor = parseNumber(cofinsMatch[3]);
  }

  // Valor total
  const totalMatch = textJoined.match(/R\$[\*]*([\d.]+,\d{2})/);
  if (totalMatch) {
    fatura.valor_total = parseNumber(totalMatch[1]);
  }

  // Bandeira
  if (text.includes("VERDE")) fatura.bandeira = "Verde";
  else if (text.includes("AMARELA")) fatura.bandeira = "Amarela";
  else if (text.includes("VERMELHA")) fatura.bandeira = "Vermelha";
  else fatura.bandeira = "Verde";

  // CIP
  const cipMatch = textJoined.match(/CONTRIB\.\s*ILUM\.\s*PÚBLICA.*?([\d,.]+)/);
  if (cipMatch) {
    fatura.cip = parseNumber(cipMatch[1]);
  }

  return fatura;
}

// ==================== HANDLER ====================

export async function POST(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const clienteId = params.clienteId;

    // Buscar cliente
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_reciee")
      .select("*")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Receber arquivos
    const formData = await request.formData();
    const files = formData.getAll("faturas") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const faturasExtraidas: Record<string, any>[] = [];
    const erros: string[] = [];
    const grupo = cliente.grupo || "B";

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        erros.push(`${file.name}: Não é um PDF`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const text = await parsePdf(buffer);

        if (!text.trim()) {
          erros.push(`${file.name}: PDF sem texto extraível`);
          continue;
        }

        let fatura: Record<string, any> | null = null;

        if (grupo === "A") {
          fatura = extrairGrupoA(text, file.name);
        } else {
          fatura = extrairGrupoB(text, file.name);
        }

        if (fatura) {
          faturasExtraidas.push(fatura);
        } else {
          erros.push(`${file.name}: Não foi possível extrair dados`);
        }
      } catch (e: any) {
        erros.push(`${file.name}: Erro ao processar - ${e.message}`);
      }
    }

    if (faturasExtraidas.length === 0) {
      return NextResponse.json({
        error: "Nenhuma fatura extraída",
        erros,
      }, { status: 422 });
    }

    // Salvar faturas no Supabase
    const faturasSalvas: Record<string, any>[] = [];
    for (const f of faturasExtraidas) {
      const { data: faturaSalva, error: faturaError } = await supabase
        .from("faturas_reciee")
        .insert({
          cliente_id: clienteId,
          competencia: f.periodo || "",
          consumo_kwh: f.consumo_kwh || 0,
          tarifa_aplicada: f.tarifa_aplicada || 0,
          valor_consumo: f.valor_consumo || 0,
          icms_valor: f.icms_valor || 0,
          icms_aliquota: f.icms_aliquota || 0,
          pis_valor: f.pis_valor || 0,
          cofins_valor: f.cofins_valor || 0,
          bandeira: f.bandeira || "Verde",
          cip: f.cip || 0,
          valor_total: f.valor_total || 0,
        })
        .select()
        .single();

      if (!faturaError && faturaSalva) {
        faturasSalvas.push(faturaSalva);
      }
    }

    // Rodar análises (simplificado - verificações básicas)
    const analisesSalvas: Record<string, any>[] = [];
    for (const fatura of faturasSalvas) {
      const analises = verificarReciee(fatura, cliente);
      for (const analise of analises) {
        const { data: analiseSalva } = await supabase
          .from("analises_reciee")
          .insert({
            fatura_id: fatura.id,
            cliente_id: clienteId,
            macro_indice: analise.macro_indice,
            codigo: analise.codigo,
            descricao: analise.descricao,
            severidade: analise.severidade,
            valor_estimado: analise.valor_estimado,
          })
          .select()
          .single();

        if (analiseSalva) {
          analisesSalvas.push(analiseSalva);
        }
      }
    }

    return NextResponse.json({
      success: true,
      faturas_extraidas: faturasSalvas.length,
      analises_geradas: analisesSalvas.length,
      erros,
    });
  } catch (error: any) {
    console.error("Erro no upload:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ==================== VERIFICAÇÕES RECIEE ====================

function verificarReciee(fatura: Record<string, any>, cliente: Record<string, any>): Record<string, any>[] {
  const analises: Record<string, any>[] = [];
  const estado = cliente.estado || "";
  const grupo = cliente.grupo || "B";

  // 1. Verificar ICMS - GO (17% para grupo B)
  if (estado === "GO" && grupo === "B") {
    const aliquotaEsperada = 17;
    if (fatura.icms_aliquota && fatura.icms_aliquota !== aliquotaEsperada) {
      const base = fatura.icms_base || fatura.valor_consumo || 0;
      const valorCorreto = base * (aliquotaEsperada / 100);
      const diferenca = (fatura.icms_valor || 0) - valorCorreto;
      if (Math.abs(diferenca) > 1) {
        analises.push({
          macro_indice: "ICMS",
          codigo: "ICMS-GO-001",
          descricao: `Alíquota ICMS divergente. Cobrado: ${fatura.icms_aliquota}%, Deveria ser: ${aliquotaEsperada}%`,
          severidade: diferenca > 0 ? "critico" : "alerta",
          valor_estimado: Math.abs(diferenca),
        });
      }
    }
  }

  // 2. Verificar ICMS - MG (18% para grupo B residencial, 12% comercial)
  if (estado === "MG" && grupo === "B") {
    const aliquotaEsperada = 18; // Simplificado
    if (fatura.icms_aliquota && fatura.icms_aliquota !== aliquotaEsperada) {
      const base = fatura.icms_base || fatura.valor_consumo || 0;
      const valorCorreto = base * (aliquotaEsperada / 100);
      const diferenca = (fatura.icms_valor || 0) - valorCorreto;
      if (Math.abs(diferenca) > 1) {
        analises.push({
          macro_indice: "ICMS",
          codigo: "ICMS-MG-001",
          descricao: `Alíquota ICMS divergente. Cobrado: ${fatura.icms_aliquota}%, Deveria ser: ${aliquotaEsperada}%`,
          severidade: diferenca > 0 ? "critico" : "alerta",
          valor_estimado: Math.abs(diferenca),
        });
      }
    }
  }

  // 3. Verificar PIS/COFINS (9,25% para lucro presumido)
  if (fatura.pis_valor && fatura.cofins_valor && fatura.valor_consumo) {
    const aliquotaTotal = 9.25;
    const valorEsperado = fatura.valor_consumo * (aliquotaTotal / 100);
    const valorCobrado = (fatura.pis_valor || 0) + (fatura.cofins_valor || 0);
    const diferenca = valorCobrado - valorEsperado;
    if (Math.abs(diferenca) > 1) {
      analises.push({
        macro_indice: "PIS/COFINS",
        codigo: "PISCOF-001",
        descricao: `PIS/COFINS com valor divergente. Cobrado: R$ ${valorCobrado.toFixed(2)}, Esperado: R$ ${valorEsperado.toFixed(2)}`,
        severidade: diferenca > 0 ? "critico" : "alerta",
        valor_estimado: Math.abs(diferenca),
      });
    }
  }

  // 4. Verificar se há leitura mínima
  if (fatura.leitura_minimo) {
    analises.push({
      macro_indice: "LEITURA",
      codigo: "LEIT-001",
      descricao: "Fatura com leitura mínima - possível cobrança indevida",
      severidade: "alerta",
      valor_estimado: 0,
    });
  }

  // 5. Verificar VRC (Verificação de Regularidade de Consumo)
  if (fatura.vrc && fatura.vrc > 0) {
    analises.push({
      macro_indice: "VRC",
      codigo: "VRC-001",
      descricao: `VRC cobrado: R$ ${fatura.vrc.toFixed(2)}`,
      severidade: "info",
      valor_estimado: fatura.vrc,
    });
  }

  // Se não encontrou problemas, registra OK
  if (analises.length === 0) {
    analises.push({
      macro_indice: "GERAL",
      codigo: "OK-001",
      descricao: "Nenhuma irregularidade encontrada nas verificações básicas",
      severidade: "ok",
      valor_estimado: 0,
    });
  }

  return analises;
}
