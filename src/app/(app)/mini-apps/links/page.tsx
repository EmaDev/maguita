import type { Metadata } from "next";
import { SavedLinks } from "@/components/organisms/mini-apps/SavedLinks";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getLinks } from "@/lib/data/links";

export const metadata: Metadata = { title: "Links guardados" };

export default async function LinksPage() {
  const session = await requireSession(ROUTES.miniAppLinks);
  const links = await getLinks(session.sub);
  return <SavedLinks links={links} />;
}
