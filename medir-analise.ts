/** Medição (19/10): onde vão os 60s da análise — extração do PDF ou IA? */
import fs from "fs";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  const { extrairTextoPdf } = await import("./lib/ia/pdf-texto");
  const { analisarFaturaTexto } = await import("./lib/ia/analisar-fatura");

  const buf = fs.readFileSync("/root/RECIEE/CROPS/000413805801280 (1).pdf");
  console.log("pdf bytes:", buf.length);

  console.time("extrairTextoPdf");
  const texto = await extrairTextoPdf(buf);
  console.timeEnd("extrairTextoPdf");
  console.log("texto len:", texto.length);

  console.time("analisarFaturaTexto");
  const res = await analisarFaturaTexto(texto);
  console.timeEnd("analisarFaturaTexto");
  console.log("resumo:", JSON.stringify(res).slice(0, 260));
}

main().catch((e) => { console.error("ERRO:", e?.message ?? e); process.exit(1); });
