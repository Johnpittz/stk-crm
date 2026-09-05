import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/setup-bulk-tables
 * Cria as tabelas necessárias para disparos em massa no Supabase.
 * Protegido: só aceita header X-Admin-Secret que bate com env var.
 */
export async function POST(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('X-Admin-Secret');
    if (adminSecret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // SQL to create/fix bulk_campaigns table with all needed columns
    const sql = `
      -- 1. Criar tabela bulk_campaigns se não existir
      CREATE TABLE IF NOT EXISTS public.bulk_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        numbers JSONB NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        sent INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Adicionar colunas que o frontend espera (se não existirem)
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS instance_name TEXT DEFAULT '';
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS phone_from TEXT;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delay_min INTEGER DEFAULT 5;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delay_max INTEGER DEFAULT 30;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS mensagem TEXT DEFAULT '';
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS campanha_id UUID;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS promocao_id UUID;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS tipo_envio TEXT DEFAULT 'avulso';
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS contatos JSONB DEFAULT '[]';
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delivered INTEGER DEFAULT 0;
      ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;

      -- 3. Criar tabela bulk_campanhas_contatos (junction) se não existir
      CREATE TABLE IF NOT EXISTS public.bulk_campanhas_contatos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
        nome TEXT DEFAULT '',
        telefone TEXT NOT NULL,
        status TEXT DEFAULT 'pendente',
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 4. Habilitar RLS
      ALTER TABLE public.bulk_campaigns ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.bulk_campanhas_contatos ENABLE ROW LEVEL SECURITY;

      -- 5. Políticas (permitir tudo para MVP)
      DROP POLICY IF EXISTS "Allow all on bulk_campaigns" ON public.bulk_campaigns;
      CREATE POLICY "Allow all on bulk_campaigns" ON public.bulk_campaigns
        FOR ALL USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Allow all on bulk_campanhas_contatos" ON public.bulk_campanhas_contatos;
      CREATE POLICY "Allow all on bulk_campanhas_contatos" ON public.bulk_campanhas_contatos
        FOR ALL USING (true) WITH CHECK (true);

      -- 6. Índices
      CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON public.bulk_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_created_at ON public.bulk_campaigns(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bulk_contatos_campaign ON public.bulk_campanhas_contatos(campaign_id);
    `;

    // Execute via Supabase SQL (using rpc or direct query)
    // Supabase JS client doesn't have raw SQL, so we use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // If rpc doesn't work, try using the SQL endpoint
    if (!response.ok) {
      // Try Supabase SQL API
      const sqlResponse = await fetch(`${supabaseUrl}/sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!sqlResponse.ok) {
        const errText = await sqlResponse.text();
        // Return the SQL for manual execution
        return NextResponse.json({
          success: false,
          error: 'Could not execute SQL automatically',
          sql_to_run: sql,
          sql_response: errText,
          hint: 'Run this SQL in Supabase SQL Editor'
        });
      }

      return NextResponse.json({ success: true, method: 'sql-api' });
    }

    return NextResponse.json({ success: true, method: 'rpc' });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      sql_hint: 'Run the migration SQL manually in Supabase SQL Editor'
    }, { status: 500 });
  }
}
