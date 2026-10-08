import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function exigeAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { status: 401 as const }
  const { data: perfil } = await supabase.from('profiles').select('cargo').eq('id', user.id).single()
  if (!['admin', 'diretor'].includes(perfil?.cargo || '')) return { status: 403 as const }
  return { status: 200 as const, supabase, user }
}

/** POST — cadastra produto (só admin/diretor; Fase 3 do dashboard) */
export async function POST(request: NextRequest) {
  try {
    const gate = await exigeAdmin()
    if (gate.status !== 200) {
      return NextResponse.json({ error: gate.status === 401 ? 'Não autorizado' : 'Sem permissão' }, { status: gate.status })
    }
    const body = await request.json()
    const nome = String(body.nome || '').trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const { data: produto, error } = await gate.supabase
      .from('produtos')
      .insert({
        nome,
        descricao: body.descricao || null,
        categoria: body.categoria || null,
        preco: body.preco ?? null,
        ativo: body.ativo ?? true,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ produto })
  } catch (err) {
    console.error('Erro ao criar produto:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/** PATCH — edita produto (só admin/diretor) */
export async function PATCH(request: NextRequest) {
  try {
    const gate = await exigeAdmin()
    if (gate.status !== 200) {
      return NextResponse.json({ error: gate.status === 401 ? 'Não autorizado' : 'Sem permissão' }, { status: gate.status })
    }
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (body.nome !== undefined) update.nome = String(body.nome).trim()
    if (body.descricao !== undefined) update.descricao = body.descricao
    if (body.categoria !== undefined) update.categoria = body.categoria
    if (body.preco !== undefined) update.preco = body.preco
    if (body.ativo !== undefined) update.ativo = body.ativo
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const { data: produto, error } = await gate.supabase
      .from('produtos')
      .update(update)
      .eq('id', body.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ produto })
  } catch (err) {
    console.error('Erro ao editar produto:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

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
      // Escapa caracteres curinga do SQL para prevenir injeção
      const buscaLimpa = busca.replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(`nome.ilike.%${buscaLimpa}%,codigo_erp.ilike.%${buscaLimpa}%,sku.ilike.%${buscaLimpa}%`)
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
