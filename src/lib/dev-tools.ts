import "server-only";

/**
 * Interruptor de las herramientas de desarrollo (`/debug`).
 *
 * **Sin prefijo `NEXT_PUBLIC_` a propósito.** Una variable pública se hornea en
 * el bundle del browser, así que cualquiera podría leerla — y, peor, sería
 * fácil creer que esconder el link alcanza. El gate real tiene que correr en el
 * server, y por eso esta variable se lee sólo acá. Las pantallas que necesiten
 * saber si está prendida la reciben como prop desde su Server Component.
 *
 * Vale sólo `"true"` exacto: un `DEV_TOOLS=false` o `DEV_TOOLS=0` mal leído
 * como "cualquier string es verdadero" dejaría las herramientas abiertas en
 * producción, que es exactamente lo que esta función existe para evitar.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.DEV_TOOLS === "true";
}

/**
 * Corta si las herramientas están apagadas.
 *
 * Va en **cada Server Action** de `/debug`, no sólo en el render de la
 * pantalla: una Server Action es un endpoint público que existe apenas se la
 * exporta, así que esconder la pantalla no la esconde a ella. Sin este chequeo,
 * las utilidades quedarían invocables en producción por cualquiera que mire el
 * bundle.
 */
export function assertDevTools(): void {
  if (!isDevToolsEnabled()) {
    throw new Error("Las herramientas de desarrollo están desactivadas.");
  }
}
