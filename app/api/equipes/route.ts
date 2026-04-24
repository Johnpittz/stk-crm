import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verifica sessão
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Busca perfil do usuário logado
    const { data: meuPerfil } = await supabase
      .from('profiles')
      .select('id, nome_completo, cargo, gestor_id')
      .eq('id', user.id)
      .single()

    if (!meuPerfil) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Se for diretoria, vê todas as equipes
    const isDiretoria = ['diretor', 'admin'].includes(meuPerfil.cargo)
    const isGestor = ['gerente_comercial'].includes(meuPerfil.cargo)
    
    // Busca vendedores da equipe
    let vendedoresQuery = supabase
      .from('profiles')
      .select('id, nome_completo, email, cargo, ativo, created_at')
      .eq('cargo', 'vendedor')

    if (!isDiretoria) {
      vendedoresQuery = vendedoresQuery.eq('gestor_id', user.id)
    }

    const { data: vendedores, error: vError } = await vendedoresQuery.order('nome_completo')

    if (vError) {
      return NextResponse.json({ error: vError.message }, { status: 500 })
    }

    // Se o gestor também tem carteira (como Gabriel), inclui ele na lista
    let todosVendedores = vendedores || []
    if (isGestor && !isDiretoria) {
      const gestorNaLista = todosVendedores.find(v => v.id === user.id)
      if (!gestorNaLista) {
        todosVendedores = [{
          id: meuPerfil.id,
          nome_completo: meuPerfil.nome_completo,
          email: '',
          cargo: meuPerfil.cargo,
          ativo: true,
          created_at: new Date().toISOString()
        }, ...todosVendedores]
      }
    }

    // Para cada vendedor, busca stats
    const vendedoresComStats = await Promise.all(
      todosVendedores.map(async (v) => {
        // Total de clientes
        const { count: totalClientes } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('vendedor_responsavel_id', v.id)

        // Total de vendas
        const { count: totalVendas } = await supabase
          .from('vendas')
          .select('*', { count: 'exact', head: true })
          .eq('vendedor_id', v.id)

        // Faturamento total
        const { data: vendasData } = await supabase
          .from('vendas')
          .select('valor_final')
          .eq('vendedor_id', v.id)
          .eq('status', 'confirmada')

        const faturamento = vendasData?.reduce((sum, v) => sum + (v.valor_final || 0), 0) || 0

        // Clientes ativos
        const { count: clientesAtivos } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('vendedor_responsavel_id', v.id)
          .eq('status', 'ativo')

        return {
          ...v,
          stats: {
            total_clientes: totalClientes || 0,
            clientes_ativos: clientesAtivos || 0,
            total_vendas: totalVendas || 0,
            faturamento
          }
        }
      })
    )

    // Stats gerais da equipe
    const statsGerais = vendedoresComStats.reduce((acc, v) => ({
      total_vendedores: acc.total_vendedores + 1,
      total_clientes: acc.total_clientes + v.stats.total_clientes,
      clientes_ativos: acc.clientes_ativos + v.stats.clientes_ativos,
      total_vendas: acc.total_vendas + v.stats.total_vendas,
      faturamento_total: acc.faturamento_total + v.stats.faturamento
    }), {
      total_vendedores: 0,
      total_clientes: 0,
      clientes_ativos: 0,
      total_vendas: 0,
      faturamento_total: 0
    })

    return NextResponse.json({
      gestor: {
        id: meuPerfil.id,
        nome: meuPerfil.nome_completo,
        cargo: meuPerfil.cargo,
        is_diretoria: isDiretoria
      },
      vendedores: vendedoresComStats,
      stats: statsGerais
    })
  } catch (err) {
    console.error('Erro no endpoint de equipes:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
