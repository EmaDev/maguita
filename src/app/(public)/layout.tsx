import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getCurrentSession, toCurrentUser } from "@/lib/auth/dal";
import { getNotifications } from "@/lib/data/notifications";

/**
 * Sección pública: usa el mismo shell que la app pero **no** exige sesión. Si
 * la hay, muestra los 5 tabs y la campana; si no, sólo la navegación de invitado.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  const notifications = session ? await getNotifications(session.sub) : [];

  return (
    <AppShell
      authed={Boolean(session)}
      user={session ? toCurrentUser(session) : undefined}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
