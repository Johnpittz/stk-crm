/**
 * Webhook para receber eventos do Millennium em tempo real
 * 
 * Endpoint: POST /api/webhooks/millennium
 * 
 * Eventos suportados:
 * - cliente.novo
 * - cliente.atualizado
 * - venda.nova
 * - venda.atualizada
 * - produto.atualizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase criado lazy para não quebrar o build
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase URL e Service Role Key são obrigatórios');
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// Chave secreta para validar webhooks do Millennium
const WEBHOOK_SECRET = process.env.MILLENNIUM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Validação de autenticação (obrigatória)
    const secretToken = request.headers.get('X-Millennium-Secret');
    
    if (!WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    if (secretToken !== WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Parse do body
    const payload = await request.json();
    
    // Evento registrado na tabela webhooks_recebidos

    // Registra o webhook recebido
    await getSupabase().from('webhooks_recebidos').insert({
      origem: 'millennium',
      evento: payload.evento,
      payload: payload,
      processado: false,
    });

    // Processa o evento
    switch (payload.evento) {
      case 'cliente.novo':
      case 'cliente.atualizado':
        await processarCliente(payload.data);
        break;
        
      case 'venda.nova':
      case 'venda.finalizada':
        await processarVenda(payload.data);
        break;
        
      case 'campanha.nova':
        await processarCampanha(payload.data);
        break;
        
      default:
        // Evento não tratado, já registrado na tabela
    }

    return NextResponse.json({ 
      success: true,
      message: 'Evento processado com sucesso'
    });
    
  } catch (error) {
    console.error('[Webhook Millennium] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}

/**
 * Processa dados de cliente do webhook
 */
async function processarCliente(data: any) {
  try {
    // Verifica se cliente já existe
    const { data: existente } = await getSupabase()
      .from('clientes')
      .select('id')
      .eq('id_externo', data.codigo)
      .single();

    const clienteData = {
      nome: data.nome || data.razao_social,
      tipo: data.tipo === 'M' || data.tipo === 'R' ? 'grupo' : 'individual',
      documento: data.cnpj_cpf,
      email: data.email,
      telefone: data.fone,
      canal_venda: mapearCanal(data.canal_venda),
      regiao: mapearRegiao(data.cidade, data.estado),
      vendedor_id: await getVendedorId(data.cod_vend),
      id_externo: data.codigo,
      status: data.ativo === 'S' ? 'ativo' : 'inativo',
      data_ultima_compra: data.dt_ultima_compra,
      ticket_medio: parseFloat(data.ticket_medio) || 0,
    };

    if (existente) {
      // Atualiza
      await getSupabase()
        .from('clientes')
        .update(clienteData)
        .eq('id', existente.id);
      
      // Cliente atualizado
    } else {
      // Insere novo
      await getSupabase().from('clientes').insert(clienteData);
      // Novo cliente criado
    }

    // Atualiza métricas de positivação
    await atualizarMetricasPositivacao(clienteData.vendedor_id);
    
  } catch (error) {
    console.error('[Webhook] Erro ao processar cliente:', error);
    throw error;
  }
}

/**
 * Processa dados de venda do webhook
 */
async function processarVenda(data: any) {
  try {
    // Busca IDs internos
    const { data: cliente } = await getSupabase()
      .from('clientes')
      .select('id')
      .eq('id_externo', data.cod_cli)
      .single();

    const { data: vendedor } = await getSupabase()
      .from('vendedores')
      .select('id')
      .eq('codigo_externo', data.cod_vend)
      .single();

    const vendaData = {
      cliente_id: cliente?.id,
      vendedor_id: vendedor?.id,
      valor_total: parseFloat(data.vlr_total),
      desconto: parseFloat(data.vlr_desconto) || 0,
      canal: mapearCanal(data.canal_venda),
      itens: data.itens?.map((item: any) => ({
        produto_id: item.cod_prod,
        quantidade: parseFloat(item.qtd),
        valor_unitario: parseFloat(item.vlr_unit),
        valor_total: parseFloat(item.vlr_total),
      })),
      id_externo: data.numero,
      created_at: data.dt_emissao,
    };

    // Upsert na tabela vendas
    await getSupabase()
      .from('vendas')
      .upsert(vendaData, { onConflict: 'id_externo' });

    // Venda processada

    // Atualiza ranking em tempo real
    await atualizarRankingVendedor(vendedor?.id);
    
    // Verifica se atinge meta
    await verificarMetaAtingida(vendedor?.id);
    
  } catch (error) {
    console.error('[Webhook] Erro ao processar venda:', error);
    throw error;
  }
}

/**
 * Processa nova campanha
 */
async function processarCampanha(data: any) {
  try {
    const campanhaData = {
      titulo: data.titulo,
      descricao: data.descricao,
      imagem: data.imagem || '🏆',
      tipo: data.tipo || 'venda',
      valor_meta: parseFloat(data.valor_meta) || null,
      data_inicio: data.dt_inicio,
      data_fim: data.dt_fim,
      ativa: data.ativa === 'S',
      id_externo: data.codigo,
    };

    await getSupabase()
      .from('campanhas')
      .upsert(campanhaData, { onConflict: 'id_externo' });

    // Campanha processada
    
  } catch (error) {
    console.error('[Webhook] Erro ao processar campanha:', error);
    throw error;
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

async function getVendedorId(codigoExterno: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('vendedores')
    .select('id')
    .eq('codigo_externo', codigoExterno)
    .single();
  return data?.id || null;
}

function mapearCanal(canal?: string): string {
  const mapa: Record<string, string> = {
    'LF': 'loja_fisica',
    'ON': 'online',
    'WH': 'whatsapp',
    'TV': 'televendas',
    'TL': 'telefone',
  };
  return mapa[canal || ''] || 'outros';
}

function mapearRegiao(cidade?: string, estado?: string): string {
  if (!cidade || !estado) return 'outros';
  
  if (cidade.toLowerCase().includes('sao paulo') && estado === 'SP') {
    return 'sp_capital';
  }
  if (estado === 'SP') return 'sp_interior';
  
  return `${estado.toLowerCase()}_${cidade.toLowerCase().replace(/\s/g, '_')}`;
}

async function atualizarMetricasPositivacao(vendedorId: string | null) {
  if (!vendedorId) return;
  
  // Dispara recálculo de positivação via RPC
  await getSupabase().rpc('recalcular_positivacao', {
    vendedor_id: vendedorId,
  });
}

async function atualizarRankingVendedor(vendedorId: string | null) {
  if (!vendedorId) return;
  
  // Atualiza cache de ranking
  await getSupabase().rpc('atualizar_ranking_vendedor', {
    vendedor_id: vendedorId,
  });
}

async function verificarMetaAtingida(vendedorId: string | null) {
  if (!vendedorId) return;
  
  // Verifica se vendedor atingiu meta e cria notificação
  const { data: meta } = await getSupabase()
    .rpc('verificar_meta_atingida', {
      vendedor_id: vendedorId,
    });
  
  if (meta?.atingiu) {
    // Cria notificação
    await getSupabase().from('notificacoes').insert({
      vendedor_id: vendedorId,
      tipo: 'meta_atingida',
      titulo: '🎉 Meta Atingida!',
      mensagem: `Parabéns! Você atingiu ${meta.percentual}% da meta mensal.`,
    });
  }
}
