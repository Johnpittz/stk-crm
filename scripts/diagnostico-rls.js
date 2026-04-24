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
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   DIAGNÓSTICO RLS - HIERARQUIA GESTOR/VENDEDOR        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 1. Verifica vínculos gestor-vendedor
  console.log('1. VÍNCULOS GESTOR → VENDEDOR:\n');
  const { data: vinculos } = await supabase
    .from('profiles')
    .select('id, nome_completo, email, cargo, gestor_id, gestor:gestor_id(nome_completo, email)')
    .in('cargo', ['vendedor', 'gerente_comercial'])
    .order('cargo', { ascending: false });

  for (const p of vinculos || []) {
    const tipo = p.cargo === 'gerente_comercial' ? '👔 GESTOR' : '👤 VENDEDOR';
    const gestorInfo = p.gestor ? `→ gestor: ${p.gestor.nome_completo}` : '→ sem gestor';
    console.log(`   ${tipo}: ${p.nome_completo} (${p.email})`);
    console.log(`      ${gestorInfo}`);
  }

  // 2. Verifica o cliente "João Teste"
  console.log('\n2. CLIENTE "JOÃO TESTE":\n');
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome_razao_social, vendedor_responsavel_id, vendedor:vendedor_responsavel_id(nome_completo, email)')
    .ilike('nome_razao_social', '%joão teste%')
    .single();

  if (cliente) {
    console.log(`   Nome: ${cliente.nome_razao_social}`);
    console.log(`   Vendedor ID: ${cliente.vendedor_responsavel_id}`);
    console.log(`   Vendedor: ${cliente.vendedor?.nome_completo || 'N/A'} (${cliente.vendedor?.email || 'N/A'})`);
  }

  // 3. Verifica IDs dos gestores
  console.log('\n3. IDs DOS GESTORES:\n');
  const { data: gestores } = await supabase
    .from('profiles')
    .select('id, nome_completo, email')
    .eq('cargo', 'gerente_comercial');

  for (const g of gestores || []) {
    console.log(`   ${g.nome_completo}: ${g.id}`);
  }

  // 4. Verifica se a função is_gestor_do_vendedor existe
  console.log('\n4. FUNÇÃO is_gestor_do_vendedor:\n');
  const { data: func } = await supabase.rpc('is_gestor_do_vendedor', { p_vendedor_id: cliente?.vendedor_responsavel_id || '00000000-0000-0000-0000-000000000000' });
  console.log(`   Resultado para vendedor Christyan: ${func}`);

  console.log('\n✅ Diagnóstico concluído!');
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
