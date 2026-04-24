import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca') || ''
    const status = searchParams.get('status') || ''
    const categoria = searchParams.get('categoria') || ''
    const marca = searchParams.get('marca') || ''
    const limite = parseInt(searchParams.get('limite') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    let query = supabase
      .from('produtos')
      .select('*', { count: 'exact' })

    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,codigo_erp.ilike.%${busca}%,sku.ilike.%${busca}%`)
    }

    if (status) {
      query = query.eq('status_produto', status)
    }

    if (categoria) {
      query = query.eq('categoria_nome', categoria)
    }

    if (marca) {
      query = query.eq('marca', marca)
    }

    const { data: produtos, error, count } = await query
      .order('nome', { ascending: true })
      .range(offset, offset + limite - 1)

    if (error) {
      console.error('Erro ao buscar produtos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Busca filtros disponíveis (marcas, categorias, status)
    const { data: filtros } = await supabase
      .from('produtos')
      .select('marca, categoria_nome, status_produto')
      .not('marca', 'is', null)

    const marcas = Array.from(new Set(filtros?.map(p => p.marca).filter(Boolean) || [])).sort()
    const categorias = Array.from(new Set(filtros?.map(p => p.categoria_nome).filter(Boolean) || [])).sort()
    const statusList = Array.from(new Set(filtros?.map(p => p.status_produto).filter(Boolean) || [])).sort()

    return NextResponse.json({
      produtos: produtos || [],
      total: count || 0,
      filtros: { marcas, categorias, status: statusList }
    })
  } catch (err) {
    console.error('Erro no endpoint de produtos:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
