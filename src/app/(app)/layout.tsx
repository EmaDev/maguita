import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireSession, toCurrentUser } from "@/lib/auth/dal";
import { getNotifications } from "@/lib/data/notifications";
import { getProfile } from "@/lib/data/profile";

/**
 * Server Component. `requireSession()` es la verificación real de la sesión: el
 * `proxy` sólo mira si la cookie existe, así que sin este chequeo una cookie
 * falsificada llegaría a renderizar las pantallas protegidas.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const [notifications, profile] = await Promise.all([
    getNotifications(session.sub),
    getProfile(session.sub),
  ]);

  return (
    <AppShell
      authed
      user={toCurrentUser(session, profile)}
      avatarUrl={profile?.avatarUrl ?? null}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
