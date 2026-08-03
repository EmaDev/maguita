import type { Metadata } from "next";
import { SettingsPanel } from "@/components/organisms/SettingsPanel";
import { ROUTES } from "@/lib/app-config";
import { logout } from "@/lib/auth/actions";
import { requireSession, toCurrentUser } from "@/lib/auth/dal";
import { getProfile } from "@/lib/data/profile";
import { isDevToolsEnabled } from "@/lib/dev-tools";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const session = await requireSession(ROUTES.ajustes);
  const profile = await getProfile(session.sub);

  return (
    <SettingsPanel
      user={toCurrentUser(session, profile)}
      avatarUrl={profile?.avatarUrl ?? null}
      logoutAction={logout}
      devTools={isDevToolsEnabled()}
    />
  );
}
