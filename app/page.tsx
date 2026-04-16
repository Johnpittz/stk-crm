import { redirect } from "next/navigation";

/**
 * Página Raiz
 * 
 * Redireciona para o login (público) ou atendimento (se autenticado).
 * TODO: Implementar verificação de autenticação.
 */

export default function HomePage() {
  redirect("/login");
}
