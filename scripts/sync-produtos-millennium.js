// ============================================================
// Sincroniza produtos do Millennium → Supabase
// ============================================================
// Uso: node scripts/sync-produtos-millennium.js
//
// Requer variáveis de ambiente no .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   MILLENNIUM_USER
//   MILLENNIUM_PASS
// ============================================================

const fs = require("fs");
const path = require("path");

// Lê o .env.local manualmente (sem precisar do dotenv)
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Arquivo .env.local não encontrado em:", envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

loadEnv();

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MILLENNIUM_USER = process.env.MILLENNIUM_USER;
const MILLENNIUM_PASS = process.env.MILLENNIUM_PASS;
const MILLENNIUM_URL = "http://roma.millenniumhosting.com.br:6017/api/millenium_eco";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Erro: Variáveis do Supabase não configuradas no .env.local");
  process.exit(1);
}

if (!MILLENNIUM_USER || !MILLENNIUM_PASS) {
  console.error("Erro: MILLENNIUM_USER e MILLENNIUM_PASS não configurados");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchMillennium(endpoint, params = {}) {
  const url = new URL(`${MILLENNIUM_URL}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const auth = Buffer.from(`${MILLENNIUM_USER}:${MILLENNIUM_PASS}`).toString("base64");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

async function buscarProdutos(pagina = 1, limite = 500) {
  console.log(`Buscando produtos... página ${pagina}`);
  return fetchMillennium("PRODUTOS", { limit: limite, offset: (pagina - 1) * limite });
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   SINCRONIZAÇÃO DE PRODUTOS - MILLENNIUM → SUPABASE   ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  try {
    // 1) Teste: busca 1 produto para ver a estrutura
    console.log("Testando conexão com Millennium...");
    const teste = await buscarProdutos(1, 1);
    console.log(`✅ Conectado! Resposta: ${Array.isArray(teste) ? teste.length : 1} registro(s)\n`);

    if (Array.isArray(teste) && teste.length > 0) {
      console.log("Exemplo de estrutura do primeiro produto:");
      console.log(JSON.stringify(teste[0], null, 2).substring(0, 1000));
      console.log("\n");
    }

    // 2) Pergunta ao usuário
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const continuar = await new Promise((resolve) => {
      readline.question("Deseja continuar e sincronizar todos os produtos? (s/n): ", (resp) => {
        resolve(resp.toLowerCase().trim() === "s");
        readline.close();
      });
    });

    if (!continuar) {
      console.log("Operação cancelada.");
      process.exit(0);
    }

    // 3) Sincronização
    console.log("\nIniciando sincronização...\n");

    let pagina = 1;
    let totalInseridos = 0;
    let totalErros = 0;
    let temMais = true;

    while (temMais) {
      const produtos = await buscarProdutos(pagina, 500);

      if (!Array.isArray(produtos) || produtos.length === 0) {
        temMais = false;
        break;
      }

      // Mapeia para o schema do Supabase
      const paraInserir = produtos.map((p) => ({
        codigo_erp: p.cod_produto || p.COD_PRODUTO || null,
        sku: p.cod_produto || p.COD_PRODUTO || null,
        nome: p.descricao || p.DESCRICAO || p.descricao_literal || "Produto sem nome",
        descricao: p.descricao_literal || p.DESCRICAO || p.descricao || null,
        preco_custo: parseFloat(p.preco_custo) || parseFloat(p.preco) * 0.6 || 0,
        preco_venda: parseFloat(p.preco_venda) || parseFloat(p.preco) || 0,
        ncm: p.codigo_ncm || p.ncm || p.NCM || null,
        ativo: true,
      })).filter((p) => p.nome && p.nome !== "Produto sem nome");

      if (paraInserir.length > 0) {
        const { error } = await supabase
          .from("produtos")
          .upsert(paraInserir, { onConflict: "codigo_erp" });

        if (error) {
          console.error(`Erro na página ${pagina}:`, error.message);
          totalErros += produtos.length;
        } else {
          totalInseridos += paraInserir.length;
          console.log(`✅ Página ${pagina}: ${paraInserir.length} produtos inseridos`);
        }
      }

      if (produtos.length < 500) {
        temMais = false;
      } else {
        pagina++;
      }
    }

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║                    RESUMO                              ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`✅ Produtos sincronizados: ${totalInseridos}`);
    console.log(`❌ Erros: ${totalErros}`);
    console.log("\nSincronização concluída!");

  } catch (err) {
    console.error("\n❌ Erro:", err.message);
    console.error("\nPossíveis causas:");
    console.error("- Credenciais do Millennium incorretas no .env.local");
    console.error("- API do Millennium indisponível");
    console.error("- Firewall bloqueando a conexão");
    process.exit(1);
  }
}

main();
