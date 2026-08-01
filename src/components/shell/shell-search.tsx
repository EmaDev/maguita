"use client";

import { createContext, useContext } from "react";

/**
 * Puente entre el buscador del `AppHeader` (que vive en el shell) y la pantalla
 * que muestra los resultados. Sin esto cada pantalla tendría que montar su
 * propio input, duplicando el que ya trae el header.
 */
interface ShellSearchValue {
  query: string;
  setQuery: (q: string) => void;
}

const ShellSearchContext = createContext<ShellSearchValue | null>(null);

export const ShellSearchProvider = ShellSearchContext.Provider;

/** Devuelve el término tipeado en el header. Fuera del shell, string vacío. */
export function useShellSearch(): ShellSearchValue {
  return (
    useContext(ShellSearchContext) ?? {
      query: "",
      setQuery: () => {},
    }
  );
}
