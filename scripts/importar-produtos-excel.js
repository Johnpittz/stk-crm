/**
 * Importa produtos do Excel (Millennium) para o Supabase
 * 
 * Uso:
 *   node scripts/importar-produtos-excel.js
 * 
 * Requer:
 *   - Arquivo crm-roma/Produtos.xlsx
 *   - Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const EXCEL_PATH = path.join(__dirname, '..', 'Produtos.xlsx');
const ENV_PATH = path.join(__dirname, '..', '.env.local');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('❌ Arquivo não encontrado:', ENV_PATH);
    process.exit(1);
  }

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

function parseDate(value) {
  if (!value || value === '' || value === '0') return null;
  if (typeof value === 'number' && value > 30000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/
    ];
    for (const fmt of formats) {
      const m = value.match(fmt);
      if (m) {
        const d = new Date(`${m[3] || m[1]}-${m[2]}-${m[1] || m[3]}`);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '' || value === 'NaN') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseBoolean(value) {
  if (!value) return false;
  return ['SIM', 'S', 'TRUE', '1', 'YES'].includes(String(value).trim().toUpperCase());
}

async function checkColumns(supabase) {
  const columnsToCheck = [
    'referencia', 'data_cadastro', 'ncm', 'colecao', 'tipo', 'departamento',
    'categoria_nome', 'divisao', 'marca', 'status_produto', 'subcolecao',
    'grupo', 'fornecedor', 'grade', 'obs', 'custo_fixo',
    'bloqueia_pedido', 'bloqueia_venda'
  ];
  
  const available = new Set();
  
  for (const col of columnsToCheck) {
    try {
      const { error } = await supabase.from('produtos').select(col).limit(1);
      if (!error || !error.message.includes(`column produtos.${col} does not exist`)) {
        available.add(col);
      }
    } catch (e) {
      // ignore
    }
  }
  
  return available;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   IMPORTAÇÃO DE PRODUTOS - EXCEL → SUPABASE           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Variáveis do Supabase não encontradas no .env.local');
    process.exit(1);
  }

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('❌ Arquivo não encontrado:', EXCEL_PATH);
    process.exit(1);
  }

  console.log('📁 Lendo:', EXCEL_PATH);

  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: null });

  const total = rows.length;
  console.log('📊 Total de produtos no Excel:', total, '\n');

  if (total === 0) {
    console.log('❌ Nenhum produto encontrado no Excel');
    process.exit(1);
  }

  console.log('Colunas encontradas:', Object.keys(rows[0]));
  console.log();

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Detecta quais colunas extras existem no schema cache do PostgREST
  console.log('Verificando schema do Supabase (isso pode levar alguns segundos)...');
  const availableCols = await checkColumns(supabase);
  
  if (availableCols.size === 0) {
    console.log('\n⚠️  Nenhuma coluna extra do Millennium detectada.');
    console.log('   A importação usará apenas as colunas básicas.');
  } else {
    console.log(`\n✅ ${availableCols.size} colunas extras detectadas:`);
    console.log('   ' + Array.from(availableCols).join(', '));
  }
  
  const missingCols = ['ncm', 'colecao', 'marca', 'referencia', 'bloqueia_pedido'].filter(c => !availableCols.has(c));
  if (missingCols.length > 0) {
    console.log('\n⚠️  Colunas ainda não disponíveis (schema cache do PostgREST pode estar desatualizado):');
    console.log('   ' + missingCols.join(', '));
    console.log('   Se acabou de aplicar a migração, aguarde 1-2 minutos e re-execute este script.\n');
  }

  const batchSize = 500;
  let inseridos = 0;
  let erros = 0;
  let ignorados = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const registros = [];

    for (const row of batch) {
      try {
        const codigo = row['Código'] !== null ? String(row['Código']).trim() : null;
        const nome = row['Descrição'] !== null ? String(row['Descrição']).trim() : null;

        if (!codigo || !nome) {
          ignorados++;
          continue;
        }

        const registro = {
          codigo_erp: codigo,
          sku: codigo,
          nome: nome || 'Produto sem nome',
          descricao: nome || null,
          preco_custo: parseDecimal(row['Custo']),
          preco_venda: 0,
          ativo: true,
        };

        // Adiciona colunas extras apenas se estiverem disponíveis no schema cache
        if (availableCols.has('referencia')) {
          registro.referencia = row['Referência'] !== null ? String(row['Referência']).trim() : null;
        }
        if (availableCols.has('data_cadastro')) {
          registro.data_cadastro = parseDate(row['Data Cadastro']);
        }
        if (availableCols.has('ncm')) {
          registro.ncm = row['Ncm'] !== null ? String(row['Ncm']).trim() : null;
        }
        if (availableCols.has('colecao')) {
          registro.colecao = row['Coleção'] !== null ? String(row['Coleção']).trim() : null;
        }
        if (availableCols.has('tipo')) {
          registro.tipo = row['Tipo'] !== null ? String(row['Tipo']).trim() : null;
        }
        if (availableCols.has('departamento')) {
          registro.departamento = row['Departamento'] !== null ? String(row['Departamento']).trim() : null;
        }
        if (availableCols.has('categoria_nome')) {
          registro.categoria_nome = row['Categoria'] !== null ? String(row['Categoria']).trim() : null;
        }
        if (availableCols.has('divisao')) {
          registro.divisao = row['Divisão'] !== null ? String(row['Divisão']).trim() : null;
        }
        if (availableCols.has('marca')) {
          registro.marca = row['Marca'] !== null ? String(row['Marca']).trim() : null;
        }
        if (availableCols.has('status_produto')) {
          registro.status_produto = row['Status'] !== null ? String(row['Status']).trim() : null;
        }
        if (availableCols.has('subcolecao')) {
          registro.subcolecao = row['Subcoleção'] !== null ? String(row['Subcoleção']).trim() : null;
        }
        if (availableCols.has('grupo')) {
          registro.grupo = row['Grupo'] !== null ? String(row['Grupo']).trim() : null;
        }
        if (availableCols.has('fornecedor')) {
          registro.fornecedor = row['Fornecedor'] !== null ? String(row['Fornecedor']).trim() : null;
        }
        if (availableCols.has('grade')) {
          registro.grade = row['Grade'] !== null ? String(row['Grade']).trim() : null;
        }
        if (availableCols.has('obs')) {
          registro.obs = row['Obs'] !== null ? String(row['Obs']).trim() : null;
        }
        if (availableCols.has('custo_fixo')) {
          registro.custo_fixo = parseDecimal(row['Custo Fixo']);
        }
        if (availableCols.has('bloqueia_pedido')) {
          registro.bloqueia_pedido = parseBoolean(row['Bloqueia Pedido']);
        }
        if (availableCols.has('bloqueia_venda')) {
          registro.bloqueia_venda = parseBoolean(row['Bloqueia Venda']);
        }

        registros.push(registro);
      } catch (e) {
        console.log('⚠️ Erro ao processar linha:', e.message);
        erros++;
      }
    }

    if (registros.length > 0) {
      try {
        const { error } = await supabase
          .from('produtos')
          .upsert(registros, { onConflict: 'codigo_erp' });

        if (error) {
          console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
          erros += registros.length;
        } else {
          inseridos += registros.length;
          console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${registros.length} produtos importados`);
        }
      } catch (e) {
        console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, e.message);
        erros += registros.length;
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMO                              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`✅ Produtos importados: ${inseridos}`);
  console.log(`⏭️  Ignorados (sem código/nome): ${ignorados}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📊 Total no Excel: ${total}`);

  if (missingCols.length > 0) {
    console.log('\n⚠️  PRÓXIMOS PASSOS:');
    console.log('   Se acabou de aplicar a migração no SQL Editor,');
    console.log('   o schema cache do PostgREST pode levar 1-2 minutos para atualizar.');
    console.log('   Re-execute este script após aguardar para importar as colunas restantes:');
    console.log('   ' + missingCols.join(', '));
  }

  console.log('\n🎉 Importação concluída!');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
