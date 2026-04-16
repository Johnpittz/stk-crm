/**
 * Layout de Autenticação
 * 
 * Grupo de rotas públicas (login, recuperar senha, etc)
 * Sem sidebar, header minimalista
 */

export const metadata = {
  title: "Login - CRM ROMA",
  description: "Acesse o CRM ROMA",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
