"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { Button, Card, PageStatusScreen, useSnackbar } from "lib-kit-components";
import { HeartIcon, TrashIcon } from "@/components/atoms/icons";
import { MiniAppBadge } from "@/components/molecules/MiniAppIcon";
import { useShellSearch } from "@/components/shell/shell-search";
import { ROUTES } from "@/lib/app-config";
import { toggleFavoriteAction } from "@/lib/data/favorites-actions";
import type { MiniApp } from "@/lib/data/mini-apps";

/**
 * Lista de favoritos. Recibe los datos ya resueltos por el server y sólo maneja
 * el filtro (que viene del buscador del AppHeader) y el quitar de favoritos.
 */
export function FavoritesList({ favorites }: { favorites: MiniApp[] }) {
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
    <ul className="space-y-2.5" aria-busy={pending}>
      {visible.map((app) => (
        <li key={app.id}>
          <Card variant="outline" padding="sm">
            <div className="flex items-center gap-3.5">
              <MiniAppBadge name={app.icon} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{app.name}</p>
                <p className="text-sm text-muted line-clamp-1">{app.description}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Quitar ${app.name} de favoritos`}
                onClick={() => remove(app)}
                disabled={pending}
              >
                <TrashIcon />
              </Button>
            </div>
          </Card>
        </li>
      ))}

      <li className="pt-2">
        <Link
          href={ROUTES.miniApps}
          className="flex items-center justify-center gap-2 h-12 rounded-2xl border border-dashed border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <HeartIcon className="w-4 h-4" />
          Agregar más desde Mini-apps
        </Link>
      </li>
    </ul>
  );
}
