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
  // Tenta selecionar a coluna bloqueia_pedido
  const { data, error } = await supabase
    .from('produtos')
    .select('bloqueia_pedido')
    .limit(1);

  if (error) {
    console.log('Erro ao acessar bloqueia_pedido:', error.message);
    console.log('Código:', error.code);
  } else {
    console.log('✅ Coluna bloqueia_pedido existe!');
    console.log('Dados:', data);
  }

  // Lista todas as colunas conhecidas pelo PostgREST (schema cache)
  console.log('\nTentando select *...');
  const { data: all, error: err2 } = await supabase
    .from('produtos')
    .select('*')
    .limit(1);

  if (err2) {
    console.error('Erro select *:', err2.message);
  } else if (all && all.length > 0) {
    console.log('Colunas disponíveis:', Object.keys(all[0]).join(', '));
  } else {
    console.log('Tabela vazia - não dá para ver colunas via select *');
  }
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
