import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/setup-bulk-tables
 * Cria as tabelas necessárias para disparos em massa no Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // First, check what tables exist
    const { data: existingTables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['bulk_campaigns', 'bulk_campanhas_contatos']);

    // Use raw SQL via Supabase's sql endpoint
    const sqlStatements = [
      // 1. Create bulk_campaigns if not exists
      `CREATE TABLE IF NOT EXISTS public.bulk_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        numbers JSONB NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        sent INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Add columns the frontend needs
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT ''`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS instance_name TEXT DEFAULT ''`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS phone_from TEXT`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delay_min INTEGER DEFAULT 5`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delay_max INTEGER DEFAULT 30`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS mensagem TEXT DEFAULT ''`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS campanha_id UUID`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS promocao_id UUID`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS tipo_envio TEXT DEFAULT 'avulso'`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS contatos JSONB DEFAULT '[]'`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS delivered INTEGER DEFAULT 0`,
      `ALTER TABLE public.bulk_campaigns ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0`,

      // 3. Create bulk_campanhas_contatos if not exists
      `CREATE TABLE IF NOT EXISTS public.bulk_campanhas_contatos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
        nome TEXT DEFAULT '',
        telefone TEXT NOT NULL,
        status TEXT DEFAULT 'pendente',
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 4. Enable RLS
      `ALTER TABLE public.bulk_campaigns ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE public.bulk_campanhas_contatos ENABLE ROW LEVEL SECURITY`,

      // 5. Policies
      `DROP POLICY IF EXISTS "Allow all on bulk_campaigns" ON public.bulk_campaigns`,
      `CREATE POLICY "Allow all on bulk_campaigns" ON public.bulk_campaigns FOR ALL USING (true) WITH CHECK (true)`,
      `DROP POLICY IF EXISTS "Allow all on bulk_campanhas_contatos" ON public.bulk_campanhas_contatos`,
      `CREATE POLICY "Allow all on bulk_campanhas_contatos" ON public.bulk_campanhas_contatos FOR ALL USING (true) WITH CHECK (true)`,

      // 6. Indexes
      `CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON public.bulk_campaigns(status)`,
      `CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_created_at ON public.bulk_campaigns(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_bulk_contatos_campaign ON public.bulk_campanhas_contatos(campaign_id)`,
    ];

    // Try Supabase SQL API
    const results: string[] = [];
    
    for (const sql of sqlStatements) {
      try {
        const response = await fetch(`${supabaseUrl}/sql`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        });
        
        const result = await response.text();
        results.push(`${response.status}: ${result.slice(0, 100)}`);
        
        if (!response.ok) {
          // Try alternative: use PostgREST rpc with a function
          // Or just continue with next statement
          results.push(`WARN: Statement may have failed: ${sql.slice(0, 60)}...`);
        }
      } catch (e: any) {
        results.push(`ERROR: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      supabaseUrl: supabaseUrl,
      results,
      message: 'Check results to see if tables were created'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to setup bulk tables',
    usage: 'curl -X POST https://stk-crm-amber.vercel.app/api/admin/setup-bulk-tables'
  });
}
