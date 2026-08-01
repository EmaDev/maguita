"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OfflineBanner, SafeArea } from "lib-kit-components";
import { BrandMark } from "@/components/atoms/icons";
import { ThemeIconButton } from "@/components/organisms/ThemeToggle";
import { APP_NAME, ROUTES } from "@/lib/app-config";

/**
 * Shell de las pantallas de autenticación, aparte del shell de la app: acá no
 * queremos bottom nav ni splash, sólo el área segura, la marca y el cambio de
 * tema. `fillViewport` usa la altura real del viewport para que el contenido
 * quede centrado sin saltar cuando el navegador móvil esconde su barra de
 * direcciones.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <SafeArea
      edges="all"
      fillViewport
      gutter={0}
      className="flex flex-col bg-surface text-foreground"
    >
      <OfflineBanner position="top" />

      <header className="flex items-center justify-between px-5 py-4">
        <Link
          href={ROUTES.miniApps}
          className="flex items-center gap-2.5 rounded-xl -m-1 p-1"
        >
          <BrandMark className="w-9 h-9" />
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        <ThemeIconButton />
      </header>

      <main className="flex-1 flex flex-col justify-center px-5 pb-10">
        <div className="w-full max-w-sm mx-auto">{children}</div>
      </main>
    </SafeArea>
  );
}
