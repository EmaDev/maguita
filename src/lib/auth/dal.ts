import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/app-config";
import type { Profile } from "@/lib/data/profile";
import { getSession, type SessionPayload } from "./session";

/**
 * Sesión del request actual. `cache` la memoiza por request, así varios Server
 * Components (layout + página) pueden pedirla sin volver a verificar la cookie
 * de Firebase cada vez.
 */
export const getCurrentSession = cache(async (): Promise<SessionPayload | null> => {
  return getSession();
});

/**
 * Verificación real de sesión para rutas protegidas. El `proxy` sólo hace un
 * chequeo optimista de la cookie; esta valida la firma de Firebase, así que
 * toda pantalla protegida tiene que pasar por acá (defensa en profundidad).
 */
export async function requireSession(
  redirectTo: string = ROUTES.inicio
): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}

/**
 * Igual que `requireSession`, pero además le pregunta a Firebase si la sesión
 * fue revocada (logout en otro dispositivo, cambio de contraseña, cuenta
 * deshabilitada).
 *
 * Cuesta un viaje de red, así que no va en el render de cada pantalla: usala en
 * las operaciones sensibles — borrar la cuenta, cambiar el email, cualquier
 * cosa con plata de por medio.
 */
export async function requireFreshSession(
  redirectTo: string = ROUTES.inicio
): Promise<SessionPayload> {
  const session = await getSession(true);
  if (!session) {
    redirect(`${ROUTES.login}?next=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  initials: string;
}

/** Primera letra de las dos primeras palabras de `name`, en mayúsculas. */
export function initialsFrom(name: string, fallback: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || fallback[0]!.toUpperCase();
}

/**
 * `session.name`/`session.email` son del momento del login (viajan en la
 * cookie); si se pasa `profile` (lectura fresca de Firestore, ver
 * `getProfile`), se usa en su lugar para no mostrar datos viejos tras editar
 * el perfil. El nombre mostrado prioriza el alias (apodo libre) sobre el
 * nombre real cuando el usuario definió uno; las iniciales del avatar de
 * respaldo siguen calculándose del nombre real, no del alias, para que no
 * cambien con cualquier apodo raro que se le ocurra poner.
 */
export function toCurrentUser(session: SessionPayload, profile?: Profile | null): CurrentUser {
  const name = profile?.name ?? session.name;
  const email = profile?.email ?? session.email;
  return {
    id: session.sub,
    name: profile?.alias?.trim() || name,
    email,
    initials: initialsFrom(name, email),
  };
}
