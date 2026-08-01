import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/app-config";
import { getCurrentSession } from "@/lib/auth/dal";

/**
 * La raíz no tiene pantalla propia: manda a Inicio si hay sesión y a Mini-apps
 * (lo público) si no, para que un visitante nuevo vea contenido en vez de un
 * formulario de login.
 */
export default async function RootPage() {
  const session = await getCurrentSession();
  redirect(session ? ROUTES.inicio : ROUTES.miniApps);
}
