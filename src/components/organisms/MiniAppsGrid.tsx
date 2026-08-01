"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  ChipCarousel,
  PageStatusScreen,
  useSnackbar,
} from "lib-kit-components";
import { HeartIcon, LockIcon } from "@/components/atoms/icons";
import { MiniAppBadge } from "@/components/molecules/MiniAppIcon";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellSearch } from "@/components/shell/shell-search";
import { ROUTES } from "@/lib/app-config";
import { toggleFavoriteAction } from "@/lib/data/favorites-actions";
import type { MiniApp } from "@/lib/data/mini-apps";

const CATEGORIES = ["Todas", "Finanzas", "Productividad", "Utilidades"] as const;

interface MiniAppsGridProps {
  apps: MiniApp[];
  /** ids en favoritos; vacío para invitados. */
  favoriteIds: string[];
  authed: boolean;
}

export function MiniAppsGrid({ apps, favoriteIds, authed }: MiniAppsGridProps) {
  const router = useRouter();
  const { query } = useShellSearch();
  const { snack } = useSnackbar();
  // BottomSheet global montado en el shell: no hace falta estado local.
  const { openSheet, closeSheet } = useAppSheet();
  const [category, setCategory] = useState<string>("Todas");
  const [pending, startTransition] = useTransition();

  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return apps.filter((app) => {
      const byCategory = category === "Todas" || app.category === category;
      const byTerm =
        !term ||
        app.name.toLowerCase().includes(term) ||
        app.description.toLowerCase().includes(term);
      return byCategory && byTerm;
    });
  }, [apps, category, query]);

  function open(app: MiniApp) {
    if (app.requiresAuth && !authed) {
      openSheet(
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            {app.name} necesita una cuenta para guardar tus datos. Creá una o
            ingresá; después volvés acá.
          </p>
          <div className="flex gap-2">
            <Button
              fullWidth
              onClick={() => {
                closeSheet();
                router.push(
                  `${ROUTES.login}?next=${encodeURIComponent(ROUTES.miniApps)}`
                );
              }}
            >
              Ingresar
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={() => {
                closeSheet();
                router.push(ROUTES.signin);
              }}
            >
              Crear cuenta
            </Button>
          </div>
        </div>,
        { title: "Necesitás una cuenta", size: "auto" }
      );
      return;
    }

    // Las mini-apps en sí no son parte de este alcance: avisamos en vez de
    // navegar a una ruta que no existe.
    snack({ message: `${app.name} se abre en la próxima versión.`, variant: "info" });
  }

  function toggleFavorite(app: MiniApp) {
    if (!authed) {
      snack({ message: "Ingresá para guardar favoritos.", variant: "info" });
      return;
    }
    const wasFavorite = favorites.has(app.id);
    startTransition(async () => {
      await toggleFavoriteAction(app.id);
      snack({
        message: wasFavorite
          ? `Quitaste ${app.name} de favoritos.`
          : `Agregaste ${app.name} a favoritos.`,
        variant: "success",
      });
    });
  }

  // Catálogo vacío: los chips de categoría no filtrarían nada, así que ni los
  // montamos. Es distinto de "los filtros no dan resultados".
  if (apps.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no hay mini-apps"
        description="Cuando se publiquen las primeras, las vas a ver acá."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ChipCarousel
        chips={CATEGORIES.map((c) => ({ id: c, label: c }))}
        value={category}
        // La firma es `string | string[]` porque el mismo componente soporta
        // selección múltiple; acá siempre llega un único id.
        onChange={(value: string | string[]) =>
          setCategory(Array.isArray(value) ? (value[0] ?? "Todas") : value)
        }
        // Sin esto, tocar el chip activo lo deselecciona y quedaría sin filtro.
        clearable={false}
        size="sm"
      />

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No encontramos mini-apps con esos filtros.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy={pending}>
          {visible.map((app) => {
            const isFavorite = favorites.has(app.id);
            return (
              <li key={app.id}>
                <Card variant="outline" padding="md" className="h-full">
                  <div className="flex items-start gap-3.5">
                    <MiniAppBadge name={app.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{app.name}</p>
                        {app.requiresAuth && !authed && (
                          <LockIcon
                            className="w-3.5 h-3.5 text-muted shrink-0"
                            aria-label="Requiere cuenta"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{app.description}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-primary">
                        {app.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button size="sm" fullWidth onClick={() => open(app)}>
                      Abrir
                    </Button>
                    <Button
                      size="icon"
                      variant={isFavorite ? "secondary" : "ghost"}
                      aria-pressed={isFavorite}
                      aria-label={
                        isFavorite
                          ? `Quitar ${app.name} de favoritos`
                          : `Agregar ${app.name} a favoritos`
                      }
                      disabled={pending}
                      onClick={() => toggleFavorite(app)}
                    >
                      <HeartIcon
                        className={isFavorite ? "w-5 h-5 text-danger" : "w-5 h-5"}
                      />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
