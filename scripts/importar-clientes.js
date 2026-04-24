/**
 * Importa carteiras de clientes do Millennium (Excel) para o Supabase
 * 
 * Uso:
 *   node scripts/importar-clientes.js
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
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

// Mapeia nome do arquivo → nome do vendedor para busca no Supabase
const MAPEAMENTO_VENDEDORES = {
  'Jackson.xlsx': 'Jackson',
  'christyian.xlsx': 'Christyan',
  'gabriel.xlsx': 'Gabriel',
  'brenda.xlsx': 'Brennda',
  'keila.xlsx': 'Keila',
  'raquel.xlsx': 'Raquel'
};

function parseExcelDate(value) {
  if (!value || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial date (dias desde 30/12/1899)
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return null;
}

function limparCNPJCPF(value) {
  if (!value) return null;
  return String(value).replace(/[^\d]/g, '');
}

function limparTelefone(value) {
  if (!value) return null;
  return String(value).replace(/[^\d]/g, '');
}

function formatarTelefone(value) {
  if (!value) return null;
  const numeros = limparTelefone(value);
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return value;
}

function parseTipoPessoa(value) {
  if (!value) return 'pf';
  const v = String(value).trim().toLowerCase();
  if (v.includes('jur')) return 'pj';
  if (v.includes('fis')) return 'pf';
  return 'pf';
}

function parseStatus(value, bloqueado) {
  if (!value) return 'inativo';
  const ativo = String(value).trim().toLowerCase();
  if (ativo !== 'sim') return 'inativo';
  if (bloqueado && String(bloqueado).trim().toLowerCase() === 'sim') return 'bloqueado';
  return 'ativo';
}

async function buscarVendedor(nome) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome_completo')
    .ilike('nome_completo', `%${nome}%`)
    .in('cargo', ['vendedor', 'gerente_comercial'])
    .single();

  if (error || !data) {
    console.log(`    ⚠️  Vendedor "${nome}" não encontrado!`);
    return null;
  }
  return data;
}

async function importarPlanilha(nomeArquivo, nomeVendedor) {
  const caminho = path.join(__dirname, '..', nomeArquivo);
  if (!fs.existsSync(caminho)) {
    console.log(`❌ Arquivo não encontrado: ${nomeArquivo}`);
    return { inseridos: 0, erros: 0, ignorados: 0 };
  }

  console.log(`\n📁 ${nomeArquivo} → Vendedor: ${nomeVendedor}`);

  // Busca vendedor no Supabase
  const vendedor = await buscarVendedor(nomeVendedor);
  if (!vendedor) {
    console.log(`   Pulando (vendedor não encontrado)`);
    return { inseridos: 0, erros: 0, ignorados: 0 };
  }
  console.log(`   ✅ Vendedor: ${vendedor.nome_completo} (ID: ${vendedor.id})`);

  // Lê Excel
  const workbook = xlsx.readFile(caminho);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 3 }); // pula 3 primeiras linhas

  let inseridos = 0;
  let erros = 0;
  let ignorados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    try {
      const codigo = row[1]; // Cód. Parceiro
      const nome = row[4] || row[3]; // Nome Parceiro ou Razão social

      if (!codigo || !nome) {
        ignorados++;
        continue;
      }

      const cpfCnpj = limparCNPJCPF(row[5]);
      const telefone = formatarTelefone(row[8]);
      const celular = formatarTelefone(row[9]);
      const email = row[22] || null;
      const endereco = row[25] || null;
      const cep = row[26] || null;
      const numero = row[28] || null;
      const complemento = row[29] || null;
      const bairro = row[30] || null;
      const cidade = row[19] || null;
      const tipo = parseTipoPessoa(row[24]);
      const status = parseStatus(row[14], row[20]);
      const dataCadastro = parseExcelDate(row[10]);

      const cliente = {
        codigo_erp: String(codigo).trim(),
        tipo,
        nome_razao_social: String(nome).trim().substring(0, 255),
        nome_fantasia: row[4] ? String(row[4]).trim().substring(0, 255) : null,
        cpf_cnpj: cpfCnpj,
        rg_ie: row[6] ? String(row[6]).trim() : null,
        email: email,
        telefone: telefone,
        celular: celular,
        endereco: endereco,
        numero: numero,
        complemento: complemento,
        bairro: bairro,
        cidade: cidade,
        status: status,
        data_cadastro: dataCadastro,
        vendedor_responsavel_id: vendedor.id,
      };

      const { error } = await supabase
        .from('clientes')
        .upsert(cliente, { onConflict: 'codigo_erp' });

      if (error) {
        console.log(`   ⚠️  Erro linha ${i + 4}: ${error.message}`);
        erros++;
      } else {
        inseridos++;
      }
    } catch (e) {
      console.log(`   ⚠️  Erro processando linha ${i + 4}: ${e.message}`);
      erros++;
    }
  }

  return { inseridos, erros, ignorados };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   IMPORTAÇÃO DE CLIENTES - EXCEL → SUPABASE           ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  let totalInseridos = 0;
  let totalErros = 0;
  let totalIgnorados = 0;

  for (const [arquivo, vendedor] of Object.entries(MAPEAMENTO_VENDEDORES)) {
    const resultado = await importarPlanilha(arquivo, vendedor);
    totalInseridos += resultado.inseridos;
    totalErros += resultado.erros;
    totalIgnorados += resultado.ignorados;
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMO GERAL                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`✅ Clientes importados: ${totalInseridos}`);
  console.log(`⏭️  Ignorados: ${totalIgnorados}`);
  console.log(`❌ Erros: ${totalErros}`);
  console.log('\n🎉 Importação concluída!');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
