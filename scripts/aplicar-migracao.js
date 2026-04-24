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

const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '002_produtos_millennium.sql'), 'utf-8');

async function run() {
  console.log('Aplicando migração 002_produtos_millennium.sql...\n');
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Erro ao executar via RPC exec_sql:', error.message);
    console.log('\nTentando via REST API...');
    // Fallback: executa statement por statement
    const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
    for (const stmt of statements) {
      const { error: e2 } = await supabase.rpc('exec_sql', { sql: stmt.trim() + ';' });
      if (e2) {
        console.error('Erro:', e2.message);
        console.error('SQL:', stmt.trim().substring(0, 100));
      }
    }
  } else {
    console.log('✅ Migração aplicada com sucesso!');
  }
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
