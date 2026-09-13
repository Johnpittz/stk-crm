import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST - Verificar se já existe cliente com determinado valor
 * Body: { field: 'uc' | 'cpf_cnpj' | 'telefone' | 'nome', value: string }
 * Retorna: { exists: boolean, cliente?: any, source?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { field, value } = body;

    if (!field || !value) {
      return NextResponse.json(
        { error: "field e value são obrigatórios" },
        { status: 400 }
      );
    }

    const normalizedValue = value.replace(/\D/g, "");

    switch (field) {
      case "uc": {
        const { data: clientesUC } = await supabase
          .from("clientes")
          .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf, instalacao")
          .eq("instalacao", normalizedValue)
          .limit(1);

        const { data: recieeUC } = await supabase
          .from("clientes_reciee")
          .select("id, nome, cpf_cnpj, uc")
          .eq("uc", normalizedValue)
          .limit(1);

        const foundUC = clientesUC?.[0] || recieeUC?.[0];
        return NextResponse.json({
          exists: !!foundUC,
          cliente: foundUC || null,
          source: clientesUC?.[0] ? "clientes" : recieeUC?.[0] ? "clientes_reciee" : null,
        });
      }

      case "cpf_cnpj": {
        const { data: clientesCPF } = await supabase
          .from("clientes")
          .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf")
          .eq("cnpj_cpf", normalizedValue)
          .limit(1);

        const { data: recieeCPF } = await supabase
          .from("clientes_reciee")
          .select("id, nome, cpf_cnpj, uc")
          .eq("cpf_cnpj", normalizedValue)
          .limit(1);

        const foundCPF = clientesCPF?.[0] || recieeCPF?.[0];
        return NextResponse.json({
          exists: !!foundCPF,
          cliente: foundCPF || null,
          source: clientesCPF?.[0] ? "clientes" : recieeCPF?.[0] ? "clientes_reciee" : null,
        });
      }

      case "telefone": {
        let foundTel = null;
        let source = null;

        // 1. Buscar na tabela clientes
        const { data: allClientes } = await supabase
          .from("clientes")
          .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf")
          .limit(1000);

        if (allClientes) {
          foundTel = allClientes.find((c: any) => {
            const tel = (c.telefone || "").replace(/\D/g, "");
            const cel = (c.celular || "").replace(/\D/g, "");
            
            if (tel === normalizedValue || cel === normalizedValue) return true;
            if (tel.length >= 8 && normalizedValue.length >= 8) {
              if (tel.slice(-8) === normalizedValue.slice(-8)) return true;
            }
            if (cel.length >= 8 && normalizedValue.length >= 8) {
              if (cel.slice(-8) === normalizedValue.slice(-8)) return true;
            }
            return false;
          });
          if (foundTel) source = "clientes";
        }

        // 2. Se não encontrou, buscar em chatbot_sessions
        if (!foundTel) {
          const { data: sessions } = await supabase
            .from("chatbot_sessions")
            .select("id, telefone, nome_lead")
            .limit(1000);

          if (sessions) {
            const session = sessions.find((s: any) => {
              const tel = (s.telefone || "").replace(/\D/g, "");
              if (tel === normalizedValue) return true;
              if (tel.length >= 8 && normalizedValue.length >= 8) {
                if (tel.slice(-8) === normalizedValue.slice(-8)) return true;
              }
              return false;
            });
            
            if (session) {
              foundTel = {
                id: session.id,
                nome_razao_social: session.nome_lead || "Lead " + session.telefone?.slice(-4),
                telefone: session.telefone,
              };
              source = "chatbot_sessions";
            }
          }
        }

        // 3. Se não encontrou, buscar em atendimentos
        if (!foundTel) {
          const { data: atendimentos } = await supabase
            .from("atendimentos")
            .select("id, telefone_cliente, nome_cliente, cliente_id")
            .limit(1000);

          if (atendimentos) {
            const atend = atendimentos.find((a: any) => {
              const tel = (a.telefone_cliente || "").replace(/\D/g, "");
              if (tel === normalizedValue) return true;
              if (tel.length >= 8 && normalizedValue.length >= 8) {
                if (tel.slice(-8) === normalizedValue.slice(-8)) return true;
              }
              return false;
            });
            
            if (atend) {
              if (atend.cliente_id) {
                const { data: clienteReal } = await supabase
                  .from("clientes")
                  .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf")
                  .eq("id", atend.cliente_id)
                  .single();
                
                if (clienteReal) {
                  foundTel = clienteReal;
                  source = "clientes";
                }
              } else {
                foundTel = {
                  id: atend.id,
                  nome_razao_social: atend.nome_cliente || "Cliente " + atend.telefone_cliente?.slice(-4),
                  telefone: atend.telefone_cliente,
                };
                source = "atendimentos";
              }
            }
          }
        }

        return NextResponse.json({
          exists: !!foundTel,
          cliente: foundTel || null,
          source,
        });
      }

      case "nome": {
        // Buscar por nome (parcial, case-insensitive)
        const nomeLower = value.toLowerCase().trim();
        
        const { data: clientesNome } = await supabase
          .from("clientes")
          .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf")
          .ilike("nome_razao_social", `%${nomeLower}%`)
          .limit(5);

        if (clientesNome && clientesNome.length > 0) {
          return NextResponse.json({
            exists: true,
            cliente: clientesNome[0],
            source: "clientes",
            allMatches: clientesNome, // Retorna todos os matches
          });
        }

        // Buscar em chatbot_sessions
        const { data: sessionsNome } = await supabase
          .from("chatbot_sessions")
          .select("id, telefone, nome_lead")
          .ilike("nome_lead", `%${nomeLower}%`)
          .limit(5);

        if (sessionsNome && sessionsNome.length > 0) {
          return NextResponse.json({
            exists: true,
            cliente: {
              id: sessionsNome[0].id,
              nome_razao_social: sessionsNome[0].nome_lead,
              telefone: sessionsNome[0].telefone,
            },
            source: "chatbot_sessions",
          });
        }

        // Buscar em atendimentos
        const { data: atendNome } = await supabase
          .from("atendimentos")
          .select("id, telefone_cliente, nome_cliente, cliente_id")
          .ilike("nome_cliente", `%${nomeLower}%`)
          .limit(5);

        if (atendNome && atendNome.length > 0) {
          const atend = atendNome[0];
          if (atend.cliente_id) {
            const { data: clienteReal } = await supabase
              .from("clientes")
              .select("id, nome_razao_social, telefone, celular, email, cnpj_cpf")
              .eq("id", atend.cliente_id)
              .single();
            
            if (clienteReal) {
              return NextResponse.json({
                exists: true,
                cliente: clienteReal,
                source: "clientes",
              });
            }
          }
          
          return NextResponse.json({
            exists: true,
            cliente: {
              id: atend.id,
              nome_razao_social: atend.nome_cliente,
              telefone: atend.telefone_cliente,
            },
            source: "atendimentos",
          });
        }

        return NextResponse.json({
          exists: false,
          cliente: null,
          source: null,
        });
      }

      default:
        return NextResponse.json(
          { error: `Campo '${field}' não suportado. Use: uc, cpf_cnpj, telefone, nome` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Erro na verificação de duplicata:", error.message);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
