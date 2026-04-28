import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/produtos/filtros - retorna apenas filtros disponíveis (buscado 1x na página)
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: filtros, error } = await supabase
      .from('produtos')
      .select('marca, categoria_nome, status_produto')
      .not('marca', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const marcas = Array.from(new Set(filtros?.map(p => p.marca).filter(Boolean) || [])).sort()
    const categorias = Array.from(new Set(filtros?.map(p => p.categoria_nome).filter(Boolean) || [])).sort()
    const statusList = Array.from(new Set(filtros?.map(p => p.status_produto).filter(Boolean) || [])).sort()

    return NextResponse.json({
      marcas,
      categorias,
      status: statusList,
    })
  } catch (err) {
    console.error('Erro no endpoint de filtros:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
