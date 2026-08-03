"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
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

    if (app.path) {
      router.push(app.path);
      return;
    }

    // Todavía no tiene pantalla propia: avisamos en vez de navegar a una
    // ruta que no existe.
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
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-busy={pending}>
          {visible.map((app) => {
            const isFavorite = favorites.has(app.id);
            return (
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
                      variant={isFavorite ? "secondary" : "ghost"}
                      aria-pressed={isFavorite}
                      aria-label={
                        isFavorite
                          ? `Quitar ${app.name} de favoritos`
                          : `Agregar ${app.name} a favoritos`
                      }
                      disabled={pending}
                      onClick={(e: MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        toggleFavorite(app);
                      }}
                      className="!h-8 !w-8 !rounded-full"
                    >
                      <HeartIcon className={isFavorite ? "w-4 h-4 text-danger" : "w-4 h-4"} />
                    </Button>
                  </div>

                  <div className="mt-auto min-w-0">
                    <p className="text-[13px] font-semibold truncate">{app.name}</p>
                    {app.requiresAuth && !authed ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-muted/10 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        <LockIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                        Requiere iniciar sesión
                      </span>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted leading-tight line-clamp-2">
                        {app.description}
                      </p>
                    )}
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
