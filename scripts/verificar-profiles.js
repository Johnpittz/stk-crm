const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ENV_PATH = path.join(__dirname, '..', '.env.local');

function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of content.split('\n')) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nome_completo, cargo')
    .order('nome_completo');

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   PERFIS CADASTRADOS NO SUPABASE                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  data.forEach(p => {
    console.log(`  ${p.nome_completo || p.email}`);
    console.log(`    ID: ${p.id}`);
    console.log(`    Email: ${p.email}`);
    console.log(`    Cargo: ${p.cargo}`);
    console.log();
  });
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
