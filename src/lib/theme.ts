/** Constantes de tema compartidas entre el script inline del server y el provider. */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "maguita:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
export const DEFAULT_THEME: Theme = "system";

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_THEME;
}

/**
 * Corre sincrónicamente en el `<head>`, mientras el browser parsea el HTML y
 * antes del primer paint: por eso no se ve el flash de tema claro que dejaría
 * un `useEffect` (que corre después de hidratar y pintar).
 *
 * Tiene que aplicar exactamente el mismo criterio que `resolvedTheme` en el
 * provider, o la clase del `<html>` y el estado de React quedarían distintos.
 * La clase es `dark` porque es la que espera el `@custom-variant` de la
 * librería y los overrides de globals.css.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem("${THEME_STORAGE_KEY}"),
d=s==="dark"||(s!=="light"&&window.matchMedia("${DARK_QUERY}").matches);
document.documentElement.classList.toggle("dark",d);
}catch(e){}})()`;
