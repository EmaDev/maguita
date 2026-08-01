"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DARK_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

/* ------------------------------------------------------------------ *
 * Store del tema elegido
 *
 * Un pub-sub mínimo en vez de `useState`: `useSyncExternalStore` da el valor
 * correcto ya en el primer render del cliente (sin un `useEffect` que
 * sincronice y dispare un render extra) y, de paso, el listener de `storage`
 * mantiene el tema en sincronía entre pestañas.
 * ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
/** Cache para no leer localStorage en cada render; se invalida al cambiar. */
let cached: Theme | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      cached = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getTheme(): Theme {
  if (cached === null) {
    try {
      cached = parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      cached = DEFAULT_THEME;
    }
  }
  return cached;
}

function writeTheme(next: Theme) {
  cached = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* modo privado o storage lleno: el tema vale sólo para esta sesión */
  }
  notify();
}

/* ------------------------------------------------------------------ *
 * Preferencia del sistema
 * ------------------------------------------------------------------ */

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/* ------------------------------------------------------------------ *
 * Provider
 * ------------------------------------------------------------------ */

interface ThemeContextValue {
  /** Lo que eligió la persona: puede ser "system". */
  theme: Theme;
  /** El tema efectivo, ya resuelto contra la preferencia del sistema. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /**
   * `false` durante el render del server y la hidratación. Los controles que
   * muestran el tema activo tienen que esperarlo: el HTML del server no puede
   * saber qué hay en localStorage, y pintar el valor real antes de hidratar
   * sería un mismatch.
   */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const noopSubscribe = () => () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    getTheme,
    () => DEFAULT_THEME
  );

  const systemTheme = useSyncExternalStore<ResolvedTheme>(
    subscribeSystem,
    getSystemTheme,
    () => "light"
  );

  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const resolved: ResolvedTheme = theme === "system" ? systemTheme : theme;
  // Hasta hidratar reportamos "light", que es lo que renderizó el server.
  const resolvedTheme: ResolvedTheme = mounted ? resolved : "light";

  // Sincroniza el DOM con el tema resuelto. El script inline del `<head>` ya
  // dejó la clase bien en la carga inicial; esto cubre los cambios posteriores.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((next: Theme) => writeTheme(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, mounted }),
    [theme, resolvedTheme, setTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme() necesita un <ThemeProvider> por encima.");
  }
  return value;
}
