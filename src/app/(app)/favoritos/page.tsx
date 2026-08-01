import type { Metadata } from "next";
import { FavoritesList } from "@/components/organisms/FavoritesList";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getFavorites } from "@/lib/data/favorites";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritosPage() {
  const session = await requireSession(ROUTES.favoritos);
  const favorites = await getFavorites(session.sub);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted leading-relaxed">
        Tus accesos directos. Usá la lupa del header para filtrarlos.
      </p>
      <FavoritesList favorites={favorites} />
    </div>
  );
}
