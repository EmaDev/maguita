import type { Chip } from "lib-kit-components";
import { WEEK_ORDER, WORKOUT_TYPES } from "@/lib/workout-model";

/**
 * Opciones de presentación de la mini-app de entrenamiento.
 *
 * Los chips de día replican los de `home/habit-options.ts` (mismo `id` =
 * `Date.getDay()` como string) en vez de importarlos: son dos módulos de
 * presentación de pantallas distintas, y el repo ya prefiere duplicar una
 * constante corta antes que acoplarlos (ver la nota de `TIME_PICKER_UPWARD`).
 * Acá además arrancan el lunes, que es como se lee un plan de entrenamiento.
 */
export const WEEKDAY_CHIPS: Chip[] = [
  { id: "1", label: "Lun" },
  { id: "2", label: "Mar" },
  { id: "3", label: "Mié" },
  { id: "4", label: "Jue" },
  { id: "5", label: "Vie" },
  { id: "6", label: "Sáb" },
  { id: "0", label: "Dom" },
];

/** Iniciales para la fila compacta de días de una card de rutina. */
export const WEEKDAY_INITIALS: { weekday: number; label: string }[] = WEEK_ORDER.map(
  (weekday, index) => ({ weekday, label: ["L", "M", "M", "J", "V", "S", "D"][index]! })
);

/** Chips de tipo de entrenamiento, con su emoji adelante. */
export const WORKOUT_TYPE_CHIPS: Chip[] = WORKOUT_TYPES.map((type) => ({
  id: type.id,
  label: `${type.emoji} ${type.label}`,
}));

/**
 * Ejemplo que muestra el sheet de importación. Es la documentación real del
 * formato: se puede copiar, pegar y editar sin salir de la app.
 */
export const IMPORT_EXAMPLE = `{
  "name": "Full body 3 días",
  "type": "gimnasio",
  "description": "Fuerza general, 3 veces por semana",
  "days": [
    {
      "weekday": "lunes",
      "title": "Tren superior",
      "exercises": [
        { "name": "Press banca", "detail": "4x10" },
        { "name": "Remo con barra", "detail": "4x12" },
        "Dominadas asistidas"
      ]
    },
    {
      "weekday": 3,
      "title": "Tren inferior",
      "exercises": [
        { "name": "Sentadilla", "detail": "5x5" },
        { "name": "Peso muerto rumano", "detail": "3x12" }
      ]
    },
    {
      "weekday": "viernes",
      "title": "Full body",
      "exercises": [{ "name": "Circuito completo", "detail": "40 min" }]
    }
  ]
}`;
