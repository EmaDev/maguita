/**
 * Las dos vistas de la mini-app de entrenamiento. El tipo vive aparte del
 * componente para que `nav-config` (que declara la fila de tabs del header) y
 * la pantalla compartan los mismos ids sin importarse entre sí — mismo
 * criterio que `home/tabs.ts`.
 */
export type WorkoutTab = "rutinas" | "ejercicios";

const WORKOUT_TAB_IDS: readonly WorkoutTab[] = ["rutinas", "ejercicios"];

/**
 * `useShellTabs()` devuelve un `string` (el shell no conoce las tabs de cada
 * pantalla) y cadena vacía mientras no hay ninguna activa: esto lo estrecha.
 */
export function isWorkoutTab(id: string): id is WorkoutTab {
  return (WORKOUT_TAB_IDS as readonly string[]).includes(id);
}
