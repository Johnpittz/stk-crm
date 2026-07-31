/**
 * Script para criar usuário de Demonstração
 * 
 * Uso: node scripts/criar-usuario-demo.js
 * 
 * Cria um usuário com cargo 'demonstracao' que tem acesso isolado.
 * Rode este script UMA VEZ após aplicar a migration 064.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Lê .env.local manualmente (dotenv pode ser interceptado por plugins)
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Arquivo .env.local não encontrado em:", envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    env[key] = value;
  });
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const EMAIL = "demo@crm-roma.com";
const SENHA = "Demo@2026";
const NOME = "Usuário Demonstração";

async function criarDemo() {
  console.log("🔄 Verificando se já existe usuário demo...");

  // Verifica se já existe
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existente = existingUsers?.users?.find((u) => u.email === EMAIL);

  if (existente) {
    console.log(`⚠️  Usuário ${EMAIL} já existe (ID: ${existente.id})`);
    console.log("   Atualizando cargo para 'demonstracao'...");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ cargo: "demonstracao", nome_completo: NOME })
      .eq("id", existente.id);

    if (updateError) {
      console.error("❌ Erro ao atualizar cargo:", updateError.message);
      process.exit(1);
    }

    console.log("✅ Cargo atualizado para 'demonstracao'");
    console.log(`\n📧 Email: ${EMAIL}`);
    console.log(`🔑 Senha: ${SENHA}`);
    console.log(`🆔 ID: ${existente.id}`);
    return;
  }

  console.log("🔄 Criando usuário de demonstração...");

  // Tenta criar via Auth Admin API primeiro
  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
    user_metadata: {
      nome_completo: NOME,
      cargo: "demonstracao",
    },
  });

  if (createError) {
    console.log(`⚠️  Auth API falhou (${createError.message})`);
    console.log("🔄 Tentando criar via SQL direto...");
    
    // Gera SQL para o usuário executar manualmente no Supabase SQL Editor
    const userId = crypto.randomUUID();
    console.log("\n📋 Copie e execute este SQL no Supabase SQL Editor:\n");
    console.log("-- ============================================================");
    console.log("-- Criar usuário de Demonstração");
    console.log("-- ============================================================");
    console.log(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    console.log("");
    console.log(`INSERT INTO auth.users (`);
    console.log(`  instance_id, id, aud, role, email, encrypted_password,`);
    console.log(`  email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data`);
    console.log(`) VALUES (`);
    console.log(`  '00000000-0000-0000-0000-000000000000',`);
    console.log(`  '${userId}',`);
    console.log(`  'authenticated',`);
    console.log(`  'authenticated',`);
    console.log(`  '${EMAIL}',`);
    console.log(`  crypt('${SENHA}', gen_salt('bf')),`);
    console.log(`  NOW(), NOW(), NOW(),`);
    console.log(`  '{"nome_completo": "${NOME}", "cargo": "demonstracao"}'::jsonb,`);
    console.log(`  '{"provider": "email", "providers": ["email"]}'::jsonb`);
    console.log(`);`);
    console.log("");
    console.log(`INSERT INTO auth.identities (`);
    console.log(`  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at`);
    console.log(`) VALUES (`);
    console.log(`  '${userId}',`);
    console.log(`  '${userId}',`);
    console.log(`  '{"sub": "${userId}", "email": "${EMAIL}"}'::jsonb,`);
    console.log(`  'email', '${EMAIL}', NOW(), NOW(), NOW()`);
    console.log(`);`);
    console.log("");
    console.log(`INSERT INTO auth.sessions (user_id, created_at, updated_at, factor_id, aal, expires_at)`);
    console.log(`VALUES ('${userId}', NOW(), NOW(), NULL, 'aal1', NOW() + INTERVAL '7 days');`);
    console.log("");
    console.log(`-- Profile (caso o trigger não crie automaticamente)`);
    console.log(`INSERT INTO public.profiles (id, nome_completo, cargo, email)`);
    console.log(`VALUES ('${userId}', '${NOME}', 'demonstracao', '${EMAIL}')`);
    console.log(`ON CONFLICT (id) DO UPDATE SET`);
    console.log(`  nome_completo = '${NOME}', cargo = 'demonstracao', email = '${EMAIL}';`);
    console.log("");
    console.log("-- ============================================================");
    console.log(`\n📧 Email: ${EMAIL}`);
    console.log(`🔑 Senha: ${SENHA}`);
    console.log("\n✅ Após executar o SQL, o usuário estará pronto!");
    process.exit(0);
  }

  console.log(`✅ Usuário criado (ID: ${authData.user.id})`);

  // Atualiza o profile (trigger já criou, mas garantimos)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      nome_completo: NOME,
      cargo: "demonstracao",
    })
    .eq("id", authData.user.id);

  if (profileError) {
    console.error("⚠️  Aviso ao atualizar profile:", profileError.message);
  } else {
    console.log("✅ Profile atualizado com cargo 'demonstracao'");
  }

  console.log("\n========================================");
  console.log("  USUÁRIO DE DEMONSTRAÇÃO CRIADO!");
  console.log("========================================");
  console.log(`📧 Email:    ${EMAIL}`);
  console.log(`🔑 Senha:    ${SENHA}`);
  console.log(`🆔 ID:       ${authData.user.id}`);
  console.log(`📋 Cargo:    demonstracao`);
  console.log("========================================");
  console.log("\nEste usuário:");
  console.log("  ✅ Pode ver: Atendimento, Kanban, Leads, Produtos, Dashboard");
  console.log("  ❌ Não vê: Clientes, Equipes, Vendas de outros");
  console.log("  🔒 Dados isolados: só vê o que criar/importar");
}

criarDemo().catch((err) => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});