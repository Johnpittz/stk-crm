/**
 * MEDIADOR LOCAL - Sincronização Millennium → CRM ROMA
 * 
 * Este script roda LOCALMENTE na máquina da empresa (onde tem acesso
 * à rede interna e o NTLM funciona com as credenciais do Windows).
 * 
 * Como usar:
 * 1. Configure as variáveis abaixo (URL do Millennium e credenciais Supabase)
 * 2. Rode: node sync-millennium-local.js
 * 3. Para agendar: Use o Agendador de Tarefas do Windows
 * 
 * O que ele faz:
 * - Busca vendas/faturamentos do Millennium na data de hoje (ou período configurado)
 * - Envia para a tabela "vendas" do Supabase (CRM)
 * - Atualiza a "data_ultima_compra" dos clientes
 * - Gera log de execução
 */

const httpntlm = require('httpntlm');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURAÇÕES
// ============================================================

// Millennium (NTLM - autenticação Windows)
const MILLENNIUM_BASE_URL = process.env.MILLENNIUM_URL || 'http://roma.millenniumhosting.com.br:6017/api/millenium_eco';
// Se precisar de usuário/senha explícitos, descomente:
// const MILLENNIUM_USER = process.env.MILLENNIUM_USER || '';
// const MILLENNIUM_PASS = process.env.MILLENNIUM_PASS || '';

// Supabase (CRM)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://otmkukicneotcpkemvcq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Período de sync (dias atrás)
const DIAS_ATRAS = parseInt(process.env.SYNC_DIAS || '1');

// ============================================================
// CLIENTE SUPABASE
// ============================================================

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada');
  console.error('   Defina a variável de ambiente ou edite este script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Faz requisição NTLM para o Millennium
function millenniumRequest(path, params = '') {
  return new Promise((resolve, reject) => {
    const url = `${MILLENNIUM_BASE_URL}${path}?${params}`;
    
    // Se tiver usuário/senha explícitos, usa eles
    // Senão, tenta NTLM com credenciais do Windows atual (workstation/domain vazios)
    const options = {
      url,
      username: process.env.MILLENNIUM_USER || '',
      password: process.env.MILLENNIUM_PASS || '',
      workstation: process.env.MILLENNIUM_WORKSTATION || '',
      domain: process.env.MILLENNIUM_DOMAIN || '',
    };

    httpntlm.get(options, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.body?.substring?.(0, 200)}`));
      }
      try {
        resolve(JSON.parse(res.body));
      } catch (e) {
        reject(new Error('Resposta não é JSON válido: ' + res.body.substring(0, 200)));
      }
    });
  });
}

// ============================================================
// SINCRONIZAÇÃO DE VENDAS
// ============================================================

async function syncVendas() {
  const hoje = new Date();
  const dataInicial = formatDate(addDays(hoje, -DIAS_ATRAS));
  const dataFinal = formatDate(hoje);

  console.log(`📅 Buscando vendas de ${dataInicial} até ${dataFinal}...`);

  try {
    // Busca faturamentos do Millennium
    const params = new URLSearchParams({
      '$format': 'json',
      'data_emissao_inicial': dataInicial,
      'data_emissao_final': dataFinal,
      'aprovado': 'true',
      'lancamentos_pedido': 'true',
      '$top': '5000',
    });

    const data = await millenniumRequest('/pedido_venda/listafaturamentos', params.toString());
    
    const vendas = data.value || data.d?.results || [];
    console.log(`📦 ${vendas.length} faturamentos encontrados`);

    if (vendas.length === 0) {
      console.log('✅ Nada para sincronizar');
      return { inseridos: 0, atualizados: 0 };
    }

    // Mapeia vendas para o schema do CRM
    const vendasMapeadas = vendas.map(v => ({
      numero_pedido: String(v.nota || v.cod_pedidov || v.pedidov || ''),
      codigo_erp: String(v.nota || v.cod_pedidov || ''),
      data_venda: v.data_emissao || v.dt_emissao,
      valor_total: parseFloat(v.valor_total || v.vlr_total || 0),
      valor_desconto: parseFloat(v.valor_desconto || v.vlr_desconto || 0),
      valor_frete: parseFloat(v.valor_frete || v.vlr_frete || 0),
      valor_final: parseFloat(v.valor_final || v.vlr_liquido || v.valor_total || 0),
      status: 'faturada',
      forma_pagamento: v.forma_pagamento || null,
      // Referências que serão resolvidas depois
      _cod_cliente: v.cod_cli || v.cliente,
      _cod_vendedor: v.cod_vend || v.vendedor,
    })).filter(v => v.numero_pedido); // Remove sem número

    console.log(`📝 ${vendasMapeadas.length} vendas válidas para importar`);

    // Busca clientes e vendedores do CRM para fazer o match
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, codigo_erp');
    
    const { data: vendedores } = await supabase
      .from('profiles')
      .select('id, email, nome_completo');

    const clienteMap = new Map((clientes || []).map(c => [String(c.codigo_erp), c.id]));
    const vendedorMap = new Map((vendedores || []).map(v => [String(v.email).toLowerCase(), v.id]));

    // Resolve referências
    const vendasProntas = vendasMapeadas.map(v => ({
      numero_pedido: v.numero_pedido,
      codigo_erp: v.codigo_erp,
      cliente_id: clienteMap.get(String(v._cod_cliente)) || null,
      vendedor_id: vendedorMap.get(String(v._cod_vendedor)?.toLowerCase()) || null,
      data_venda: v.data_venda,
      valor_total: v.valor_total,
      valor_desconto: v.valor_desconto,
      valor_frete: v.valor_frete,
      valor_final: v.valor_final,
      status: v.status,
      forma_pagamento: v.forma_pagamento,
      sincronizado_erp: true,
    }));

    // Upsert no Supabase (ignora conflito de numero_pedido)
    const { data: resultado, error } = await supabase
      .from('vendas')
      .upsert(vendasProntas, { 
        onConflict: 'numero_pedido',
        ignoreDuplicates: false // atualiza se existir
      });

    if (error) {
      console.error('❌ Erro ao salvar no Supabase:', error.message);
      throw error;
    }

    // Atualiza data_ultima_compra dos clientes
    const clientesAtualizados = new Set(vendasProntas.filter(v => v.cliente_id).map(v => v.cliente_id));
    for (const clienteId of clientesAtualizados) {
      const ultimaVenda = vendasProntas
        .filter(v => v.cliente_id === clienteId)
        .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
      
      if (ultimaVenda) {
        await supabase
          .from('clientes')
          .update({ data_ultima_compra: ultimaVenda.data_venda })
          .eq('id', clienteId);
      }
    }

    console.log(`✅ Sincronização concluída!`);
    console.log(`   - Vendas sincronizadas: ${vendasProntas.length}`);
    console.log(`   - Clientes atualizados: ${clientesAtualizados.size}`);

    return { inseridos: vendasProntas.length, clientesAtualizados: clientesAtualizados.size };

  } catch (err) {
    console.error('❌ Erro na sincronização:', err.message);
    throw err;
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MEDIADOR MILLENNIUM → CRM ROMA                       ║');
  console.log(`║     ${new Date().toLocaleString('pt-BR')}                           ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  try {
    const resultado = await syncVendas();
    console.log('\n🏁 Finalizado com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 Finalizado com erro:', err.message);
    process.exit(1);
  }
})();
