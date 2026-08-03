"use client";

import { useMemo, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, PageStatusScreen, useSnackbar } from "lib-kit-components";
import { HeartIcon, PlusIcon } from "@/components/atoms/icons";
import { MiniAppBadge } from "@/components/molecules/MiniAppIcon";
import { useShellSearch } from "@/components/shell/shell-search";
import { ROUTES } from "@/lib/app-config";
import { toggleFavoriteAction } from "@/lib/data/favorites-actions";
import type { MiniApp } from "@/lib/data/mini-apps";

/**
 * Lista de favoritos: misma grilla de cards cuadradas que `MiniAppsGrid`
 * (ver esa para el layout original) — acá el catálogo es siempre favoritos,
 * así que no hace falta el estado `isFavorite` ni el aviso de "requiere
 * sesión" (esta pantalla ya está protegida por sesión). El corazón sale
 * siempre lleno y tocarlo quita en vez de agregar. Recibe los datos ya
 * resueltos por el server y sólo maneja el filtro (que viene del buscador
 * del AppHeader) y el quitar de favoritos.
 */
export function FavoritesList({ favorites }: { favorites: MiniApp[] }) {
  const router = useRouter();
  const { query, setQuery } = useShellSearch();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return favorites;
    return favorites.filter(
      (app) =>
        app.name.toLowerCase().includes(term) ||
        app.description.toLowerCase().includes(term) ||
        app.category.toLowerCase().includes(term)
    );
  }, [favorites, query]);

  function open(app: MiniApp) {
    if (app.path) {
      router.push(app.path);
      return;
    }
    // Todavía no tiene pantalla propia: avisamos en vez de navegar a una
    // ruta que no existe (mismo criterio que `MiniAppsGrid`).
    snack({ message: `${app.name} se abre en la próxima versión.`, variant: "info" });
  }

  function remove(app: MiniApp) {
    startTransition(async () => {
      await toggleFavoriteAction(app.id);
      snack({
        message: `Quitaste ${app.name} de favoritos.`,
        variant: "neutral",
        action: {
          label: "Deshacer",
          // Volver a togglear lo restaura: la acción es simétrica.
          onClick: () => startTransition(() => toggleFavoriteAction(app.id)),
        },
      });
    });
  }

  if (favorites.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no tenés favoritos"
        description="Marcá las mini-apps que más usás para tenerlas siempre a mano."
      />
    );
  }

  if (visible.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-foreground font-medium">Sin resultados para “{query}”.</p>
        <Button variant="ghost" className="mt-3" onClick={() => setQuery("")}>
          Limpiar búsqueda
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-busy={pending}>
      {visible.map((app) => (
        <li key={app.id}>
          <Card
            variant="elevated"
            padding="sm"
            interactive
            onClick={() => open(app)}
            className="relative flex flex-col aspect-square"
          >
            <MiniAppBadge name={app.icon} category={app.category} />

            <div className="absolute top-2 right-2">
              <Button
                size="icon"
                variant="secondary"
                aria-pressed={true}
                aria-label={`Quitar ${app.name} de favoritos`}
                disabled={pending}
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  remove(app);
                }}
                className="!h-8 !w-8 !rounded-full"
              >
                <HeartIcon className="w-4 h-4 text-danger" />
              </Button>
            </div>

            <div className="mt-auto min-w-0">
              <p className="text-[13px] font-semibold truncate">{app.name}</p>
              <p className="mt-0.5 text-xs text-muted leading-tight line-clamp-2">
                {app.description}
              </p>
            </div>
          </Card>
        </li>
      ))}

      <li>
        <Link
          href={ROUTES.miniApps}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <PlusIcon className="w-5 h-5" />
          Agregar más
        </Link>
      </li>
    </ul>
  );
}
