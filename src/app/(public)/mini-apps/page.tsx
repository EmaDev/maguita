import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "lib-kit-components";
import { MiniAppsGrid } from "@/components/organisms/MiniAppsGrid";
import { ROUTES } from "@/lib/app-config";
import { getCurrentSession } from "@/lib/auth/dal";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getMiniApps } from "@/lib/data/mini-apps";

export const metadata: Metadata = {
  title: "Mini-apps",
  description:
    "Explorá todas las mini-apps de Maguita. Algunas se usan sin cuenta.",
};

/** Ruta pública: se puede ver sin sesión, y se enriquece si la hay. */
export default async function MiniAppsPage() {
  const session = await getCurrentSession();
  const [apps, favoriteIds] = await Promise.all([
    getMiniApps(),
    session ? getFavoriteIds(session.sub) : Promise.resolve<string[]>([]),
  ]);

  return (
    <div className="space-y-5">
      {!session && (
        <Card variant="gradient" padding="md">
          <p className="text-sm leading-relaxed">
            Estás navegando como invitado. Varias mini-apps funcionan así; para
            guardar favoritos y usar el asistente,{" "}
            <Link href={ROUTES.signin} className="font-semibold underline">
              creá tu cuenta
            </Link>
            .
          </p>
        </Card>
      )}

      <MiniAppsGrid
        apps={apps}
        favoriteIds={favoriteIds}
        authed={Boolean(session)}
      />
    </div>
  );
}
