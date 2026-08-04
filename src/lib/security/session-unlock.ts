/**
 * Marca de "ya desbloqueado" de un módulo con PinLock, viva mientras dure la
 * pestaña/app. `sessionStorage` y no `usePersistentState` (`idb`/`local`, ver
 * `lib-kit-components`) a propósito: acá queremos lo contrario a sobrevivir un
 * cierre — que el candado se vuelva a pedir al cerrar y reabrir.
 */
const key = (moduleId: string) => `maguita:unlocked:${moduleId}`;

export function isUnlockedThisSession(moduleId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(key(moduleId)) === "1";
}

export function markUnlockedThisSession(moduleId: string): void {
  window.sessionStorage.setItem(key(moduleId), "1");
}
