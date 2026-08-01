"use client";

import { createContext, useContext } from "react";

/**
 * Puente entre la fila de tabs del `AppHeader` (que vive en el shell) y la
 * pantalla que muestra el contenido de cada tab. Mismo patrón que
 * `shell-search`: el header es único y se resuelve por ruta, así que la
 * pantalla no monta sus propias tabs — lee cuál está activa.
 */
interface ShellTabsValue {
  /** Id de la tab activa. Cadena vacía si la pantalla no declara tabs. */
  tab: string;
  setTab: (id: string) => void;
}

const ShellTabsContext = createContext<ShellTabsValue | null>(null);

export const ShellTabsProvider = ShellTabsContext.Provider;

/** Devuelve la tab activa del header. Fuera del shell, cadena vacía. */
export function useShellTabs(): ShellTabsValue {
  return useContext(ShellTabsContext) ?? { tab: "", setTab: () => {} };
}
