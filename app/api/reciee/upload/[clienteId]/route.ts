import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Increase function timeout (Vercel Pro: 300s max, Hobby: 60s max)
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parse PDF using pdf2json (pure Node.js, no browser dependencies)
function parsePdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFParser = require("pdf2json");
    const pdfParser = new PDFParser();

    const timeout = setTimeout(() => {
      reject(new Error("Timeout ao processar PDF (30s)"));
    }, 30000);

    pdfParser.on("pdfParser_dataError", (err: any) => {
      clearTimeout(timeout);
      reject(new Error(err?.parserError?.message || "Erro ao parsear PDF"));
    });

    pdfParser.on("pdfParser_dataReady", (data: any) => {
      clearTimeout(timeout);
      let text = "";
      const pages = data.Pages || [];
      for (const page of pages) {
        const texts = page.Texts || [];
        for (const t of texts) {
          const runs = t.R || [];
          for (const run of runs) {
            try {
              text += decodeURIComponent(run.T || "") + " ";
            } catch {
              text += (run.T || "") + " ";
            }
          }
          text += "\n";
        }
      }
      resolve(text);
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ==================== FUNÇÕES DE EXTRAÇÃO ====================

function parseNumber(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

// Helper: find a line by keyword and return the next N lines as values
function findAndGetNext(lines: string[], keyword: string, skip = 1, count = 10): string[] {
  const idx = lines.findIndex((l) => l.toUpperCase().includes(keyword.toUpperCase()));
  if (idx < 0) return [];
  return lines.slice(idx + skip, idx + skip + count);
}

// Helper: extract the first number found in a string
function extractFirstNumber(s: string): number {
  const m = s.match(/[\d.,]+/);
  return m ? parseNumber(m[0]) : 0;
}

function extrairGrupoB(text: string, filename: string): Record<string, any> | null {
  if (!text.includes("CONSUMO")) return null;

  const fatura: Record<string, any> = { arquivo: filename };

  // Período (MM/YYYY)
  const periodoMatches = text.match(/[A-Z]{3}\/\d{4}/g);
  if (periodoMatches) {
    fatura.periodo = periodoMatches[periodoMatches.length - 1];
  }

  const lines = text.split("\n").map((ln) => ln.trim()).filter(Boolean);

  // === CONSUMO section ===
  // After "CONSUMO" + "kWh": tarifa, consumo_kwh, valor_consumo, base, aliq%, icms_valor, tarifa_total
  const consumoValues = findAndGetNext(lines, "CONSUMO", 2, 10);
  if (consumoValues.length >= 7) {
    fatura.tarifa_aplicada = extractFirstNumber(consumoValues[0]); // R$/kWh
    fatura.consumo_kwh = extractFirstNumber(consumoValues[1]); // kWh
    fatura.valor_consumo = extractFirstNumber(consumoValues[2]); // R$
    // consumoValues[3] = base (com bandeira)
    // consumoValues[4] = ICMS %
    const aliqStr = consumoValues[4] || "";
    fatura.icms_aliquota = extractFirstNumber(aliqStr);
    fatura.icms_valor = extractFirstNumber(consumoValues[5]); // ICMS R$
    // consumoValues[6] = tarifa total
  }

  // === Bandeira (ADC BANDEIRA) ===
  const bandeiraIdx = lines.findIndex((l) => l.toUpperCase().includes("ADC BANDEIRA"));
  if (bandeiraIdx >= 0) {
    const bLine = lines[bandeiraIdx];
    if (bLine.toUpperCase().includes("VERDE")) fatura.bandeira = "Verde";
    else if (bLine.toUpperCase().includes("AMARELA")) fatura.bandeira = "Amarela";
    else if (bLine.toUpperCase().includes("VERMELHA")) fatura.bandeira = "Vermelha";
    // Bandeira kWh value might be on the next line
    if (bandeiraIdx + 1 < lines.length) {
      fatura.bandeira_valor = extractFirstNumber(lines[bandeiraIdx + 1]);
    }
  } else {
    // Fallback: check text
    if (text.includes("VERDE")) fatura.bandeira = "Verde";
    else if (text.includes("AMARELA")) fatura.bandeira = "Amarela";
    else if (text.includes("VERMELHA")) fatura.bandeira = "Vermelha";
    else fatura.bandeira = "Verde";
  }

  // === PIS/PASEP ===
  const pisIdx = lines.findIndex((l) => l.toUpperCase().includes("PIS/PASEP") || l.toUpperCase().includes("PIS"));
  if (pisIdx >= 0) {
    // Multi-line: PIS/PASEP / aliquota% / base / valor
    const nextLines = lines.slice(pisIdx + 1, pisIdx + 5);
    for (const nl of nextLines) {
      if (nl.includes("%")) {
        fatura.pis_aliquota = extractFirstNumber(nl);
      } else if (!fatura.pis_valor && extractFirstNumber(nl) > 0) {
        if (!fatura.pis_base) {
          fatura.pis_base = extractFirstNumber(nl);
        } else {
          fatura.pis_valor = extractFirstNumber(nl);
        }
      }
    }
  }

  // === ICMS ===
  if (!fatura.icms_aliquota) {
    const icmsIdx = lines.findIndex((l) => l.toUpperCase().trim() === "ICMS");
    if (icmsIdx >= 0) {
      const nextLines = lines.slice(icmsIdx + 1, icmsIdx + 5);
      for (const nl of nextLines) {
        if (nl.includes("%")) {
          fatura.icms_aliquota = extractFirstNumber(nl);
        } else if (!fatura.icms_valor && extractFirstNumber(nl) > 0) {
          if (!fatura.icms_base) {
            fatura.icms_base = extractFirstNumber(nl);
          } else {
            fatura.icms_valor = extractFirstNumber(nl);
          }
        }
      }
    }
  }

  // === COFINS ===
  const cofinsIdx = lines.findIndex((l) => l.toUpperCase().trim() === "COFINS");
  if (cofinsIdx >= 0) {
    const nextLines = lines.slice(cofinsIdx + 1, cofinsIdx + 5);
    for (const nl of nextLines) {
      if (nl.includes("%")) {
        fatura.cofins_aliquota = extractFirstNumber(nl);
      } else if (!fatura.cofins_valor && extractFirstNumber(nl) > 0) {
        if (!fatura.cofins_base) {
          fatura.cofins_base = extractFirstNumber(nl);
        } else {
          fatura.cofins_valor = extractFirstNumber(nl);
        }
      }
    }
  }

  // === CIP ===
  const cipIdx = lines.findIndex((l) => l.toUpperCase().includes("CONTRIB") && l.toUpperCase().includes("ILUM"));
  if (cipIdx >= 0 && cipIdx + 1 < lines.length) {
    fatura.cip = extractFirstNumber(lines[cipIdx + 1]);
  }

  // === Valor total (R$*******X.XXX,XX) ===
  const rsLines = lines.filter((l) => l.match(/R\$\*+/));
  if (rsLines.length > 0) {
    const m = rsLines[0].match(/R\$\*+([\d.,]+)/);
    if (m) {
      fatura.valor_total = parseNumber(m[1]);
    }
  }

  // === VRC ===
  const vrcMatch = text.match(/VRC\s*=\s*R\$\s*([\d.,]+)/);
  if (vrcMatch) {
    fatura.vrc = parseNumber(vrcMatch[1]);
  }

  // === Leitura mínima ===
  fatura.leitura_minimo = text.toUpperCase().includes("MÍNIMO");

  // === Consumo NF (ENERGIA ATIVA - KWH) ===
  const nfIdx = lines.findIndex((l) => l.toUpperCase().includes("ENERGIA ATIVA"));
  if (nfIdx >= 0 && nfIdx + 1 < lines.length) {
    const m = lines[nfIdx + 1].match(/(\d+)\s+(\d+)/);
    if (m) {
      fatura.consumo_nf = parseInt(m[1]);
      fatura.leitura_atual = parseInt(m[2]);
    }
  }

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

  // CONSUMO - multi-line
  const consumoIdx = lines.findIndex((l) => l.toUpperCase().includes("CONSUMO"));
  if (consumoIdx >= 0) {
    const nextLines = lines.slice(consumoIdx + 1, consumoIdx + 10);
    for (const nl of nextLines) {
      if (nl.toUpperCase().includes("KWH")) continue;
      const val = extractFirstNumber(nl);
      if (val > 0 && !fatura.consumo_kwh) fatura.consumo_kwh = val;
    }
  }

  // DEMANDA
  const demandaIdx = lines.findIndex((l) => l.toUpperCase().includes("DEMANDA"));
  if (demandaIdx >= 0 && demandaIdx + 1 < lines.length) {
    fatura.demanda_kw = extractFirstNumber(lines[demandaIdx + 1]);
  }

  // Tarifa
  const tarifaIdx = lines.findIndex((l) => l.toUpperCase().includes("TARIFA"));
  if (tarifaIdx >= 0 && tarifaIdx + 1 < lines.length) {
    fatura.tarifa_aplicada = extractFirstNumber(lines[tarifaIdx + 1]);
  }

  // ICMS - multi-line
  const icmsIdx = lines.findIndex((l) => l.toUpperCase().trim() === "ICMS");
  if (icmsIdx >= 0) {
    const nextLines = lines.slice(icmsIdx + 1, icmsIdx + 5);
    for (const nl of nextLines) {
      if (nl.includes("%")) fatura.icms_aliquota = extractFirstNumber(nl);
      else if (!fatura.icms_valor && extractFirstNumber(nl) > 0) {
        if (!fatura.icms_base) fatura.icms_base = extractFirstNumber(nl);
        else fatura.icms_valor = extractFirstNumber(nl);
      }
    }
  }

  // PIS/COFINS - multi-line
  const pisIdx = lines.findIndex((l) => l.toUpperCase().includes("PIS"));
  if (pisIdx >= 0) {
    const nextLines = lines.slice(pisIdx + 1, pisIdx + 5);
    for (const nl of nextLines) {
      if (!fatura.pis_valor && extractFirstNumber(nl) > 0) {
        fatura.pis_valor = extractFirstNumber(nl);
      }
    }
  }

  const cofinsIdx = lines.findIndex((l) => l.toUpperCase().includes("COFINS"));
  if (cofinsIdx >= 0) {
    const nextLines = lines.slice(cofinsIdx + 1, cofinsIdx + 5);
    for (const nl of nextLines) {
      if (!fatura.cofins_valor && extractFirstNumber(nl) > 0) {
        fatura.cofins_valor = extractFirstNumber(nl);
      }
    }
  }

  // Valor total
  const rsLines = lines.filter((l) => l.match(/R\$\*+/));
  if (rsLines.length > 0) {
    const m = rsLines[0].match(/R\$\*+([\d.,]+)/);
    if (m) fatura.valor_total = parseNumber(m[1]);
  }

  // Bandeira
  if (text.includes("VERDE")) fatura.bandeira = "Verde";
  else if (text.includes("AMARELA")) fatura.bandeira = "Amarela";
  else if (text.includes("VERMELHA")) fatura.bandeira = "Vermelha";
  else fatura.bandeira = "Verde";

  // CIP
  const cipIdx = lines.findIndex((l) => l.toUpperCase().includes("CONTRIB") && l.toUpperCase().includes("ILUM"));
  if (cipIdx >= 0 && cipIdx + 1 < lines.length) {
    fatura.cip = extractFirstNumber(lines[cipIdx + 1]);
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
