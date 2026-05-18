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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

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

    return NextResponse.json({
      produtos: produtos || [],
      total: count || 0,
    })
  } catch (err) {
    console.error('Erro no endpoint de produtos:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
