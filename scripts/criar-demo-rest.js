/**
 * Cria usuário demo via REST API do Supabase Admin
 * Uso: node scripts/criar-demo-rest.js
 */
const fs = require("fs");
const path = require("path");

// Lê .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const content = fs.readFileSync(envPath, "utf-8");
const env = {};
content.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) return;
  env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function criarDemo() {
  console.log("🔄 Deletando usuário existente (se houver)...");
  
  // Lista usuários para encontrar o demo
  const listRes = await fetch(`${URL}/auth/v1/admin/users`, {
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "apikey": KEY,
    },
  });
  const listData = await listRes.json();
  const existente = listData?.users?.find((u) => u.email === "demo@crm-roma.com");
  
  if (existente) {
    console.log(`   Usuário existente encontrado (ID: ${existente.id}). Deletando...`);
    await fetch(`${URL}/auth/v1/admin/users/${existente.id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "apikey": KEY,
      },
    });
    console.log("   ✅ Deletado.");
    
    // Deleta o profile também
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(URL, KEY);
    await supabase.from("profiles").delete().eq("id", existente.id);
    console.log("   ✅ Profile deletado.");
  }

  console.log("\n🔄 Criando usuário via REST API...");
  
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "apikey": KEY,
    },
    body: JSON.stringify({
      email: "demo@crm-roma.com",
      password: "Demo@2026",
      email_confirm: true,
      user_metadata: {
        nome_completo: "Demonstração",
        cargo: "vendedor",
      },
    }),
  });

  const data = await res.json();

  if (!data.id) {
    console.error("❌ Erro ao criar usuário:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`✅ Usuário criado (ID: ${data.id})`);

  // Atualiza o profile para cargo 'demonstracao'
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(URL, KEY);

  // Espera 1 segundo para o trigger criar o profile
  await new Promise((r) => setTimeout(r, 1000));

  const { error } = await supabase
    .from("profiles")
    .update({ cargo: "demonstracao", nome_completo: "Demonstração" })
    .eq("id", data.id);

  if (error) {
    console.error("⚠️  Erro ao atualizar profile:", error.message);
    console.log("   Tente atualizar manualmente no Supabase Dashboard");
  } else {
    console.log("✅ Profile atualizado com cargo 'demonstracao'");
  }

  console.log("\n========================================");
  console.log("  USUÁRIO CRIADO COM SUCESSO!");
  console.log("========================================");
  console.log("📧 Email:    demo@crm-roma.com");
  console.log("🔑 Senha:    Demo@2026");
  console.log("🆔 ID:       " + data.id);
  console.log("📋 Cargo:    demonstracao");
  console.log("========================================");
}

criarDemo().catch((err) => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});