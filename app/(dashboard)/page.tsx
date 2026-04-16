import { redirect } from "next/navigation";

/**
 * Redirect da raiz do dashboard
 * 
 * Redireciona o usuário para a página de atendimento (principal)
 * após o login ou ao acessar "/" autenticado.
 */

export default function DashboardPage() {
  redirect("/atendimento");
}
