import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, any> = {};
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { count: atendCount } = await supabase
      .from("atendimentos")
      .select("*", { count: "exact", head: true });
    
    const { count: msgsCount } = await supabase
      .from("atendimento_mensagens")
      .select("*", { count: "exact", head: true });
    
    checks.supabase = "ok";
    checks.atendimentos = atendCount;
    checks.mensagens = msgsCount;
  } catch (e: any) {
    checks.supabase = e.message;
  }
  
  checks.env = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  
  return NextResponse.json(checks);
}
