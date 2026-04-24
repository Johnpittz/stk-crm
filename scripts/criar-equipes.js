/**
 * Cria gestores e vendedores no Supabase com hierarquia
 * 
 * Requer que a migração 004_hierarquia_gestores.sql já tenha sido aplicada
 * 
 * Uso:
 *   node scripts/criar-equipes.js
 */

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

const GESTORES = [
  {
    nome: 'Murilo',
    email: 'gestorcomercial@romagyn.com.br',
    senha: 'rm170611',
    cargo: 'gerente_comercial'
  },
  {
    nome: 'Gabriel',
    email: 'gestorcomercial@romadistribuicao.com.br',
    senha: 'rm170611',
    cargo: 'gerente_comercial'
  }
];

const VENDEDORES = [
  // Equipe Murilo
  { nome: 'Jackson', email: 'jackson@romagyn.com.br', gestor_email: 'gestorcomercial@romagyn.com.br' },
  { nome: 'Christyan', email: 'christyan@romagyn.com.br', gestor_email: 'gestorcomercial@romagyn.com.br' },
  { nome: 'Raquel', email: 'raquel@romagyn.com.br', gestor_email: 'gestorcomercial@romagyn.com.br' },
  // Equipe Gabriel
  { nome: 'Brennda', email: 'brennda@romadistribuicao.com.br', gestor_email: 'gestorcomercial@romadistribuicao.com.br' },
  { nome: 'Keila', email: 'keila@romadistribuicao.com.br', gestor_email: 'gestorcomercial@romadistribuicao.com.br' },
  // Gabriel também é vendedor da própria equipe
  { nome: 'Gabriel', email: 'gestorcomercial@romadistribuicao.com.br', gestor_email: 'gestorcomercial@romadistribuicao.com.br', ja_existe: true }
];

async function criarUsuario(nome, email, senha, cargo) {
  console.log(`\n  Criando: ${nome} (${email})...`);
  
  const { data: existente } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();
  
  if (existente) {
    console.log(`    ⚠️  Já existe! ID: ${existente.id}`);
    return existente.id;
  }

  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome_completo: nome }
  });

  if (error) {
    console.log(`    ❌ Erro ao criar usuário: ${error.message}`);
    return null;
  }

  const userId = user.user.id;

  // Atualiza profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ nome_completo: nome, cargo })
    .eq('id', userId);

  if (updateError) {
    console.log(`    ❌ Erro ao atualizar profile: ${updateError.message}`);
  } else {
    console.log(`    ✅ Criado! ID: ${userId}`);
  }

  return userId;
}

async function vincularVendedor(vendedorId, gestorId) {
  const { error } = await supabase
    .from('profiles')
    .update({ gestor_id: gestorId })
    .eq('id', vendedorId);

  if (error) {
    console.log(`    ❌ Erro ao vincular: ${error.message}`);
    return false;
  }
  console.log(`    ✅ Vinculado ao gestor!`);
  return true;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   CRIAÇÃO DE EQUIPES - GESTORES E VENDEDORES          ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Verifica se a migração foi aplicada
  console.log('\nVerificando se a coluna gestor_id existe...');
  const { error: checkError } = await supabase
    .from('profiles')
    .select('gestor_id')
    .limit(1);

  if (checkError && checkError.message.includes('column profiles.gestor_id does not exist')) {
    console.log('\n❌ ERRO: A migração 004_hierarquia_gestores.sql ainda não foi aplicada!');
    console.log('   Execute no SQL Editor do Supabase antes de rodar este script.\n');
    process.exit(1);
  }

  console.log('✅ Coluna gestor_id detectada. Prosseguindo...\n');

  // 1. Criar gestores
  console.log('━━━ CRIANDO GESTORES ━━━');
  const gestorIds = {};
  
  for (const g of GESTORES) {
    const id = await criarUsuario(g.nome, g.email, g.senha, g.cargo);
    if (id) gestorIds[g.email] = id;
  }

  // 2. Criar vendedores
  console.log('\n━━━ CRIANDO VENDEDORES ━━━');
  const vendedorIds = {};
  
  for (const v of VENDEDORES) {
    if (v.ja_existe) {
      // Gabriel já foi criado como gestor
      const { data } = await supabase.from('profiles').select('id').eq('email', v.email).single();
      if (data) {
        vendedorIds[v.email] = data.id;
        console.log(`\n  ${v.nome} (${v.email})`);
        console.log(`    ⚠️  Já existe como gestor. Vinculando à própria equipe...`);
        await vincularVendedor(data.id, gestorIds[v.gestor_email]);
      }
      continue;
    }

    const id = await criarUsuario(v.nome, v.email, 'rm170611', 'vendedor');
    if (id) vendedorIds[v.email] = id;
  }

  // 3. Vincular vendedores aos gestores
  console.log('\n━━━ VINCULANDO VENDEDORES AOS GESTORES ━━━');
  
  for (const v of VENDEDORES) {
    if (v.ja_existe) continue;
    
    const vendedorId = vendedorIds[v.email];
    const gestorId = gestorIds[v.gestor_email];
    
    if (!vendedorId || !gestorId) {
      console.log(`\n  ⚠️  Pulando ${v.nome} (ID não encontrado)`);
      continue;
    }

    console.log(`\n  ${v.nome} → ${v.gestor_email}`);
    await vincularVendedor(vendedorId, gestorId);
  }

  // 4. Resumo
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMO                              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const { data: equipes } = await supabase
    .from('profiles')
    .select('nome_completo, email, cargo, gestor_id, gestor:gestor_id(nome_completo, email)')
    .in('cargo', ['vendedor', 'gerente_comercial'])
    .order('cargo', { ascending: false });

  console.log('\nEquipes cadastradas:\n');
  
  const gestores = equipes?.filter(p => p.cargo === 'gerente_comercial') || [];
  for (const g of gestores) {
    console.log(`👔 ${g.nome_completo} (${g.email})`);
    const vendedores = equipes?.filter(p => p.gestor_id === g.id) || [];
    for (const v of vendedores) {
      console.log(`   👤 ${v.nome_completo} (${v.email})`);
    }
    if (vendedores.length === 0) console.log('   (sem vendedores vinculados)');
  }

  console.log('\n🎉 Configuração de equipes concluída!');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
