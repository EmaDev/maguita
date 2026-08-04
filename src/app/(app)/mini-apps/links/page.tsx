import type { Metadata } from "next";
import { ModuleLockGate } from "@/components/organisms/security/ModuleLockGate";
import { SavedLinks } from "@/components/organisms/mini-apps/SavedLinks";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getLinks } from "@/lib/data/links";
import { getProfile } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Links guardados" };

export default async function LinksPage() {
  const session = await requireSession(ROUTES.miniAppLinks);
  const [links, profile] = await Promise.all([
    getLinks(session.sub),
    getProfile(session.sub),
  ]);
  const pinSet = Boolean(profile?.preferences.pinHash);
  const locked = pinSet && (profile?.preferences.lockedModules.includes("links-guardados") ?? false);

  return (
    <ModuleLockGate moduleId="links-guardados" moduleLabel="Links guardados" locked={locked}>
      <SavedLinks links={links} pinSet={pinSet} locked={locked} />
    </ModuleLockGate>
  );
}
