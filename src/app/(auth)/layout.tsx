import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/app-config";
import { getCurrentSession } from "@/lib/auth/dal";
import { AuthShell } from "./AuthShell";

/**
 * Server Component: delega en el shell cliente, así las pantallas de auth
 * siguen pudiendo exportar `metadata`.
 *
 * Además es el único lugar que decide "ya estás logueado, andá a inicio", y lo
 * hace con la verificación real de la cookie (`getCurrentSession`), no con su
 * mera presencia. Antes esto vivía en el `proxy`, que sólo puede mirar si la
 * cookie existe: con una cookie presente pero inválida el proxy mandaba a
 * inicio y `requireSession()` devolvía a login, en bucle.
 *
 * Al cubrir el route group entero, vale para login, signin y
 * recuperar-password sin mantener una lista de rutas aparte.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentSession()) {
    redirect(ROUTES.inicio);
  }

  return <AuthShell>{children}</AuthShell>;
}
