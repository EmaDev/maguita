/**
 * Las dos vistas de la mini-app Billetera. El tipo vive aparte del componente
 * para que `nav-config` (que declara la fila de tabs del header) y la pantalla
 * compartan los mismos ids sin importarse entre sí — mismo criterio que
 * `home/tabs.ts` y `workout-tabs.ts`.
 */
export type WalletTab = "principal" | "billeteras";

/**
 * Id del módulo para PinLock (`UserPreferences.lockedModules`) y para el
 * borrado por módulo de Ajustes (`RESETTABLE_MODULES`). Es el mismo `MiniApp.id`
 * del catálogo, y vive acá para que la página (que resuelve `locked`) y el
 * panel (que monta el `PinLockSwitch`) no lo escriban cada uno por su lado.
 */
export const MODULE_ID = "billetera";

const WALLET_TAB_IDS: readonly WalletTab[] = ["principal", "billeteras"];

/**
 * `useShellTabs()` devuelve un `string` (el shell no conoce las tabs de cada
 * pantalla) y cadena vacía mientras no hay ninguna activa: esto lo estrecha.
 */
export function isWalletTab(id: string): id is WalletTab {
  return (WALLET_TAB_IDS as readonly string[]).includes(id);
}
