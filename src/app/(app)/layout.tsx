import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireSession, toCurrentUser } from "@/lib/auth/dal";
import { getNotifications } from "@/lib/data/notifications";

/**
 * Server Component. `requireSession()` es la verificación real de la sesión: el
 * `proxy` sólo mira si la cookie existe, así que sin este chequeo una cookie
 * falsificada llegaría a renderizar las pantallas protegidas.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const notifications = await getNotifications(session.sub);

  return (
    <AppShell authed user={toCurrentUser(session)} notifications={notifications}>
      {children}
    </AppShell>
  );
}
