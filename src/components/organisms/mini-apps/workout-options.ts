import type { Chip } from "lib-kit-components";
import type { WorkoutRoutine, WorkoutRoutineDay } from "@/lib/data/workouts";
import { WEEK_ORDER, WORKOUT_TYPES, splitDetail, workoutTypeMeta } from "@/lib/workout-model";

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

/**
 * Nombre completo del día, indexado por `Date.getDay()`. Lo comparten el
 * composer (que titula el bloque de cada día marcado) y el detalle de una
 * rutina (que titula el panel de cada tab): estaba duplicado como constante
 * local en el composer, y son dos vistas del **mismo** dato, así que acá sí
 * conviene una sola fuente — a diferencia de los chips de día, que replican a
 * propósito los de los hábitos.
 */
export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Abreviatura de tres letras, indexada por `Date.getDay()`. Para las tabs de día del detalle, donde "Miércoles" no entra. */
export const WEEKDAY_SHORT: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

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
 * Forma exportable de una rutina: exactamente la que acepta la importación, así
 * que el JSON que sale de una cuenta entra en otra sin editarlo. Por eso no
 * incluye `id`, `active` ni `createdAt` — son de esta cuenta, no de la rutina.
 */
export function routineToJson(routine: WorkoutRoutine): string {
  return JSON.stringify(
    {
      name: routine.name,
      type: routine.type,
      description: routine.description,
      days: routine.days.map((day) => ({
        weekday: day.weekday,
        title: day.title,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          detail: exercise.detail,
        })),
      })),
    },
    null,
    2
  );
}

/**
 * El plan de un día como texto plano, para compartirlo donde no se puede
 * mandar la imagen: es el fallback de WhatsApp en desktop, donde no existe
 * `navigator.share` con archivos y el link `wa.me` sólo acepta texto.
 *
 * Usa el mismo `splitDetail` que la pantalla y la imagen, así los tres
 * muestran el bloque partido igual. Sin markdown de WhatsApp (`*negrita*`): en
 * el campo de texto se ve el asterisco crudo hasta que se manda, y un plan de
 * entrenamiento no gana nada con negritas.
 */
export function routineDayToText(routine: WorkoutRoutine, day: WorkoutRoutineDay): string {
  const type = workoutTypeMeta(routine.type);
  const lines = [
    `${type.emoji} ${routine.name}`,
    `${(WEEKDAY_LABELS[day.weekday] ?? "").toUpperCase()} — ${day.title}`,
    "",
  ];

  day.exercises.forEach((exercise, index) => {
    lines.push(`${index + 1}. ${exercise.name}`);
    const parts = exercise.detail ? splitDetail(exercise.detail) : [];
    if (parts.length === 1) {
      lines.push(`   ${parts[0]}`);
    } else {
      for (const part of parts) lines.push(`   • ${part}`);
    }
  });

  if (day.exercises.length === 0) lines.push("Sin ejercicios cargados.");

  return lines.join("\n");
}

/**
 * Ejemplo que muestra el sheet de importación. Es la documentación real del
 * formato: se puede copiar, pegar y editar sin salir de la app.
 *
 * El día del viernes trae el `detail` largo a propósito: es lo único que
 * muestra que el detalle no está limitado a "4x10" y que un bloque de CrossFit
 * entero es un valor válido. Sin un caso así en el ejemplo, el formato se lee
 * como si sólo aceptara series por repeticiones.
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
      "exercises": [
        {
          "name": "Metcon (For Time)",
          "detail": "3 rondas: 15 burpees + 20 kettlebell swing + 400 m de trote"
        }
      ]
    }
  ]
}`;
