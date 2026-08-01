/**
 * Las cuatro vistas de Inicio. El tipo vive aparte de `HomeBoard` para que
 * `nav-config` (que declara la fila de tabs del header) y los paneles que piden
 * cambiar de tab compartan los mismos ids sin importarse entre sí.
 */
export type HomeTab = "resumen" | "movimientos" | "notas" | "habitos";

const HOME_TAB_IDS: readonly HomeTab[] = [
  "resumen",
  "movimientos",
  "notas",
  "habitos",
];

/**
 * `useShellTabs()` devuelve un `string` (el shell no conoce las tabs de cada
 * pantalla) y cadena vacía mientras no hay ninguna activa: esto lo estrecha.
 */
export function isHomeTab(id: string): id is HomeTab {
  return (HOME_TAB_IDS as readonly string[]).includes(id);
}
