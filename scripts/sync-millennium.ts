#!/usr/bin/env ts-node
/**
 * Script de Sincronização Inicial - Millennium → Supabase
 * 
 * Uso:
 *   npx ts-node scripts/sync-millennium.ts --clientes --vendas --vendedores
 *   npx ts-node scripts/sync-millennium.ts --tudo --desde=2020-01-01
 */

import { millenniumSync } from '../lib/integrations/millennium-api';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Args {
  clientes?: boolean;
  vendas?: boolean;
  vendedores?: boolean;
  campanhas?: boolean;
  tudo?: boolean;
  desde?: string;
  dryRun?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  
  process.argv.slice(2).forEach((arg) => {
    if (arg === '--clientes') args.clientes = true;
    if (arg === '--vendas') args.vendas = true;
    if (arg === '--vendedores') args.vendedores = true;
    if (arg === '--campanhas') args.campanhas = true;
    if (arg === '--tudo') args.tudo = true;
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--desde=')) args.desde = arg.split('=')[1];
  });
  
  return args;
}

async function main() {
  const args = parseArgs();
  const dataInicio = args.desde || '2020-01-01';
  
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     SINCRONIZAÇÃO MILLENNIUM → SUPABASE               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Data de início: ${dataInicio}`);
  console.log(`Modo: ${args.dryRun ? 'SIMULAÇÃO (dry-run)' : 'PRODUÇÃO'}`);
  console.log('');

  const resultados: Record<string, any> = {};

  try {
    // 1. VENDEDORES (primeiro, pois vendas dependem deles)
    if (args.tudo || args.vendedores) {
      console.log('📊 [1/4] Sincronizando vendedores...');
      const start = Date.now();
      
      if (!args.dryRun) {
        const r = await millenniumSync.syncVendedores();
        resultados.vendedores = r;
        console.log(`   ✅ ${r.sincronizados} vendedores sincronizados (${r.erros} erros)`);
      } else {
        console.log('   [DRY-RUN] Simulando sincronização de vendedores...');
      }
      
      console.log(`   ⏱️  ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log('');
    }

    // 2. CLIENTES
    if (args.tudo || args.clientes) {
      console.log('👥 [2/4] Sincronizando clientes...');
      const start = Date.now();
      
      if (!args.dryRun) {
        const r = await millenniumSync.syncClientes(dataInicio);
        resultados.clientes = r;
        console.log(`   ✅ ${r.sincronizados} clientes sincronizados (${r.erros} erros)`);
      } else {
        console.log('   [DRY-RUN] Simulando sincronização de clientes...');
      }
      
      console.log(`   ⏱️  ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log('');
    }

    // 3. VENDAS (por período, pode ser pesado)
    if (args.tudo || args.vendas) {
      console.log('💰 [3/4] Sincronizando vendas...');
      console.log('   Isso pode levar alguns minutos dependendo do período...');
      
      const start = Date.now();
      const dataFim = new Date().toISOString().split('T')[0];
      
      if (!args.dryRun) {
        const r = await millenniumSync.syncVendas(dataInicio, dataFim);
        resultados.vendas = r;
        console.log(`   ✅ ${r.sincronizadas} vendas sincronizadas (${r.erros} erros)`);
      } else {
        console.log('   [DRY-RUN] Simulando sincronização de vendas...');
      }
      
      console.log(`   ⏱️  ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log('');
    }

    // 4. CAMPANHAS
    if (args.tudo || args.campanhas) {
      console.log('🏆 [4/4] Sincronizando campanhas...');
      const start = Date.now();
      
      // TODO: Implementar syncCampanhas no service
      console.log('   ⏭️  Feature em desenvolvimento');
      
      console.log(`   ⏱️  ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log('');
    }

    // RESUMO
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMO                              ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    if (resultados.vendedores) {
      console.log(`📊 Vendedores: ${resultados.vendedores.sincronizados} OK, ${resultados.vendedores.erros} erros`);
    }
    if (resultados.clientes) {
      console.log(`👥 Clientes:   ${resultados.clientes.sincronizados} OK, ${resultados.clientes.erros} erros`);
    }
    if (resultados.vendas) {
      console.log(`💰 Vendas:     ${resultados.vendas.sincronizadas} OK, ${resultados.vendas.erros} erros`);
    }
    
    console.log('');
    console.log('✅ Sincronização concluída!');
    
    // Atualiza cache final
    if (!args.dryRun) {
      console.log('🔄 Atualizando cache de rankings...');
      await supabase.rpc('atualizar_todos_rankings');
      console.log('✅ Cache atualizado!');
    }

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    process.exit(1);
  }
}

// Executa se for chamado diretamente
if (require.main === module) {
  main();
}

export { main };
