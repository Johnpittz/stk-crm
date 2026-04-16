/**
 * Serviço de Integração com API Millennium
 * 
 * Documentação: roma.millenniumhosting.com.br:6017/api/millenium_eco/$help
 * 
 * Endpoints disponíveis:
 * - CLIENTES
 * - PEDIDO_VENDA (vendas)
 * - CAMPANHAS_VENDA
 * - FUNCIONARIOS (vendedores)
 * - PRODUTOS
 * - CRM (chamados/oportunidades)
 */

import { createClient } from '@supabase/supabase-js';

// Configuração da API Millennium
const MILLENNIUM_BASE_URL = 'http://roma.millenniumhosting.com.br:6017/api/millenium_eco';
const MILLENNIUM_AUTH = {
  username: process.env.MILLENNIUM_USER || '',
  password: process.env.MILLENNIUM_PASS || '',
};

// Cliente Supabase para sincronização
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface MillenniumConfig {
  baseUrl: string;
  auth: {
    username: string;
    password: string;
  };
}

class MillenniumAPI {
  private config: MillenniumConfig;

  constructor(config: MillenniumConfig) {
    this.config = config;
  }

  /**
   * Faz requisição autenticada para API Millennium
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}/${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password}`
      ).toString('base64')}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[MillenniumAPI] Erro em ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== CLIENTES ====================
  
  /**
   * Busca todos os clientes
   */
  async getClientes(params?: {
    data_inicio?: string;
    data_fim?: string;
    cidade?: string;
    vendedor_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.data_inicio) queryParams.append('dt_inc', params.data_inicio);
    if (params?.data_fim) queryParams.append('dt_inc_ate', params.data_fim);
    if (params?.cidade) queryParams.append('cidade', params.cidade);
    if (params?.vendedor_id) queryParams.append('cod_vend', params.vendedor_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `CLIENTES${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  /**
   * Busca cliente por código
   */
  async getClienteById(codigo: string) {
    return this.request<any>(`CLIENTES?codigo=${codigo}`);
  }

  // ==================== VENDAS (PEDIDO_VENDA) ====================

  /**
   * Busca pedidos/vendas
   */
  async getVendas(params?: {
    data_inicio?: string;
    data_fim?: string;
    vendedor_id?: string;
    cliente_id?: string;
    status?: string; // 'F' = Finalizado, 'A' = Aberto
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.data_inicio) queryParams.append('dt_emissao', params.data_inicio);
    if (params?.data_fim) queryParams.append('dt_emissao_ate', params.data_fim);
    if (params?.vendedor_id) queryParams.append('cod_vend', params.vendedor_id);
    if (params?.cliente_id) queryParams.append('cod_cli', params.cliente_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `PEDIDO_VENDA${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  /**
   * Busca detalhes de uma venda específica
   */
  async getVendaById(numero: string) {
    return this.request<any>(`PEDIDO_VENDA?numero=${numero}`);
  }

  // ==================== VENDEDORES (FUNCIONARIOS) ====================

  /**
   * Busca vendedores/funcionários
   */
  async getVendedores(params?: {
    ativo?: boolean;
    filial?: string;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.ativo !== undefined) queryParams.append('ativo', params.ativo ? 'S' : 'N');
    if (params?.filial) queryParams.append('cod_filial', params.filial);

    const endpoint = `FUNCIONARIOS${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  // ==================== PRODUTOS ====================

  /**
   * Busca produtos
   */
  async getProdutos(params?: {
    ativo?: boolean;
    categoria?: string;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.ativo !== undefined) queryParams.append('ativo', params.ativo ? 'S' : 'N');
    if (params?.categoria) queryParams.append('cod_grupo', params.categoria);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const endpoint = `PRODUTOS${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  // ==================== CAMPANHAS ====================

  /**
   * Busca campanhas de venda ativas
   */
  async getCampanhas(params?: {
    data_inicio?: string;
    data_fim?: string;
    ativa?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.data_inicio) queryParams.append('dt_inicio', params.data_inicio);
    if (params?.data_fim) queryParams.append('dt_fim', params.data_fim);
    if (params?.ativa !== undefined) queryParams.append('ativa', params.ativa ? 'S' : 'N');

    const endpoint = `CAMPANHAS_VENDA${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  // ==================== CRM / CHAMADOS ====================

  /**
   * Busca oportunidades/chamados do CRM
   */
  async getOportunidadesCRM(params?: {
    vendedor_id?: string;
    status?: string;
    data_inicio?: string;
    tipo?: string;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params?.vendedor_id) queryParams.append('cod_vend', params.vendedor_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.data_inicio) queryParams.append('dt_abertura', params.data_inicio);
    if (params?.tipo) queryParams.append('tipo', params.tipo);

    const endpoint = `CRM${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return this.request<any[]>(endpoint);
  }
}

// ==================== SERVIÇOS DE SINCRONIZAÇÃO ====================

export class MillenniumSyncService {
  private api: MillenniumAPI;

  constructor() {
    this.api = new MillenniumAPI({
      baseUrl: MILLENNIUM_BASE_URL,
      auth: MILLENNIUM_AUTH,
    });
  }

  /**
   * Sincroniza clientes do Millennium → Supabase
   */
  async syncClientes(dataInicio?: string): Promise<{
    sincronizados: number;
    erros: number;
  }> {
    console.log('[Sync] Iniciando sincronização de clientes...');
    
    try {
      // Busca clientes da API Millennium
      const clientesMillennium = await this.api.getClientes({
        data_inicio: dataInicio || '2020-01-01',
        limit: 1000,
      });

      let sincronizados = 0;
      let erros = 0;

      for (const cliente of clientesMillennium) {
        try {
          // Mapeia dados do Millennium para nosso schema
          const clienteMapeado = {
            nome: cliente.NOME || cliente.RAZAO_SOCIAL,
            tipo: this.mapearTipoCliente(cliente.TIPO), // 'grupo' ou 'individual'
            documento: cliente.CNPJ_CPF,
            email: cliente.EMAIL,
            telefone: cliente.FONE,
            endereco: {
              logradouro: cliente.ENDERECO,
              cidade: cliente.CIDADE,
              estado: cliente.ESTADO,
              cep: cliente.CEP,
            },
            canal_venda: this.mapearCanal(cliente.CANAL_VENDA),
            regiao: this.mapearRegiao(cliente.CIDADE, cliente.ESTADO),
            vendedor_id: await this.getVendedorIdByCodigo(cliente.COD_VEND),
            id_externo: cliente.CODIGO, // referência ao Millennium
            status: cliente.ATIVO === 'S' ? 'ativo' : 'inativo',
            data_ultima_compra: cliente.DT_ULTIMA_COMPRA,
            ticket_medio: parseFloat(cliente.TICKET_MEDIO) || 0,
          };

          // Insere ou atualiza no Supabase
          const { error } = await supabase
            .from('clientes')
            .upsert(clienteMapeado, {
              onConflict: 'id_externo',
            });

          if (error) {
            console.error(`[Sync] Erro no cliente ${cliente.CODIGO}:`, error);
            erros++;
          } else {
            sincronizados++;
          }
        } catch (err) {
          console.error(`[Sync] Erro ao processar cliente:`, err);
          erros++;
        }
      }

      console.log(`[Sync] Clientes: ${sincronizados} sincronizados, ${erros} erros`);
      return { sincronizados, erros };
      
    } catch (error) {
      console.error('[Sync] Erro na sincronização de clientes:', error);
      throw error;
    }
  }

  /**
   * Sincroniza vendas do Millennium → Supabase
   */
  async syncVendas(dataInicio: string, dataFim: string): Promise<{
    sincronizadas: number;
    erros: number;
  }> {
    console.log(`[Sync] Iniciando sincronização de vendas (${dataInicio} a ${dataFim})...`);
    
    try {
      const vendasMillennium = await this.api.getVendas({
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'F', // Apenas finalizadas
        limit: 5000,
      });

      let sincronizadas = 0;
      let erros = 0;

      for (const venda of vendasMillennium) {
        try {
          // Busca cliente_id interno pelo código do Millennium
          const { data: cliente } = await supabase
            .from('clientes')
            .select('id')
            .eq('id_externo', venda.COD_CLI)
            .single();

          // Busca vendedor_id interno
          const { data: vendedor } = await supabase
            .from('vendedores')
            .select('id')
            .eq('codigo_externo', venda.COD_VEND)
            .single();

          const vendaMapeada = {
            cliente_id: cliente?.id,
            vendedor_id: vendedor?.id,
            valor_total: parseFloat(venda.VLR_TOTAL),
            desconto: parseFloat(venda.VLR_DESCONTO) || 0,
            canal: this.mapearCanal(venda.CANAL_VENDA),
            itens: venda.ITENS?.map((item: any) => ({
              produto_id: item.COD_PROD,
              quantidade: parseFloat(item.QTD),
              valor_unitario: parseFloat(item.VLR_UNIT),
              valor_total: parseFloat(item.VLR_TOTAL),
            })),
            id_externo: venda.NUMERO,
            created_at: venda.DT_EMISSAO,
          };

          const { error } = await supabase
            .from('vendas')
            .upsert(vendaMapeada, {
              onConflict: 'id_externo',
            });

          if (error) {
            console.error(`[Sync] Erro na venda ${venda.NUMERO}:`, error);
            erros++;
          } else {
            sincronizadas++;
          }
        } catch (err) {
          console.error(`[Sync] Erro ao processar venda:`, err);
          erros++;
        }
      }

      // Atualiza cache de rankings após sincronizar vendas
      await this.atualizarRankings();

      console.log(`[Sync] Vendas: ${sincronizadas} sincronizadas, ${erros} erros`);
      return { sincronizadas, erros };
      
    } catch (error) {
      console.error('[Sync] Erro na sincronização de vendas:', error);
      throw error;
    }
  }

  /**
   * Sincroniza vendedores
   */
  async syncVendedores(): Promise<{
    sincronizados: number;
    erros: number;
  }> {
    console.log('[Sync] Iniciando sincronização de vendedores...');
    
    try {
      const vendedoresMillennium = await this.api.getVendedores({ ativo: true });

      let sincronizados = 0;
      let erros = 0;

      for (const vend of vendedoresMillennium) {
        try {
          const vendedorMapeado = {
            nome: vend.NOME,
            email: vend.EMAIL,
            telefone: vend.FONE,
            canal: this.mapearCanal(vend.CANAL_PADRAO),
            codigo_externo: vend.CODIGO,
            ativo: vend.ATIVO === 'S',
            meta_mensal: parseFloat(vend.META_MENSAL) || 0,
          };

          const { error } = await supabase
            .from('vendedores')
            .upsert(vendedorMapeado, {
              onConflict: 'codigo_externo',
            });

          if (error) {
            erros++;
          } else {
            sincronizados++;
          }
        } catch (err) {
          erros++;
        }
      }

      return { sincronizados, erros };
      
    } catch (error) {
      console.error('[Sync] Erro na sincronização de vendedores:', error);
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private mapearTipoCliente(tipoMillennium: string): 'grupo' | 'individual' {
    // Lógica: se tiver rede/cadastro matriz, é grupo
    return tipoMillennium === 'M' || tipoMillennium === 'R' ? 'grupo' : 'individual';
  }

  private mapearCanal(canalMillennium?: string): string {
    const mapa: Record<string, string> = {
      'LF': 'loja_fisica',
      'ON': 'online',
      'WH': 'whatsapp',
      'TV': 'televendas',
      'TL': 'telefone',
    };
    return mapa[canalMillennium || ''] || 'outros';
  }

  private mapearRegiao(cidade?: string, estado?: string): string {
    if (!cidade || !estado) return 'outros';
    
    // Lógica simples de mapeamento
    if (cidade.toLowerCase().includes('sao paulo') && estado === 'SP') {
      return 'sp_capital';
    }
    if (estado === 'SP') {
      return 'sp_interior';
    }
    return `${estado.toLowerCase()}_${cidade.toLowerCase().replace(/\s/g, '_')}`;
  }

  private async getVendedorIdByCodigo(codigo: string): Promise<string | null> {
    const { data } = await supabase
      .from('vendedores')
      .select('id')
      .eq('codigo_externo', codigo)
      .single();
    
    return data?.id || null;
  }

  private async atualizarRankings(): Promise<void> {
    // Dispara função no Supabase para recalcular rankings
    await supabase.rpc('atualizar_rankings_cache');
  }
}

// ==================== EXPORTS ====================

export const millenniumAPI = new MillenniumAPI({
  baseUrl: MILLENNIUM_BASE_URL,
  auth: MILLENNIUM_AUTH,
});

export const millenniumSync = new MillenniumSyncService();

export default MillenniumAPI;
