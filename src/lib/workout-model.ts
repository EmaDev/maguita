import type { WorkoutType } from "@/lib/firebase/collections";
import { longestStreakOf, shiftDay, streakOf, weekdayOf } from "@/lib/home-model";
import type { WorkoutRoutine, WorkoutRoutineDay } from "@/lib/data/workouts";

/**
 * Cálculos de la mini-app de entrenamiento. Funciones puras, sin
 * `"use client"` ni `"server-only"`: las comparten las Server Actions (que
 * validan el tipo de rutina) y la pantalla (que deriva racha y progreso), así
 * los dos lados sacan los mismos números.
 *
 * Las fechas son *day keys* (`yyyy-mm-dd`) y los días de la semana siguen la
 * convención `Date.getDay()` (0 = domingo … 6 = sábado), igual que los
 * hábitos — ver `src/lib/home-model.ts`, de donde salen los helpers de fecha.
 */

export interface WorkoutTypeMeta {
  id: WorkoutType;
  label: string;
  emoji: string;
}

/**
 * Tipos de entrenamiento. Lista cerrada (no un input libre) por el mismo
 * motivo que la paleta de emojis de los hábitos: el tipo pinta un chip de
 * ancho acotado y se usa para agrupar, así que dejar escribir cualquier cosa
 * llenaría la UI de variantes del mismo tipo ("gym", "Gym", "gimnasio").
 */
export const WORKOUT_TYPES: WorkoutTypeMeta[] = [
  { id: "gimnasio", label: "Gimnasio", emoji: "🏋️" },
  { id: "crossfit", label: "CrossFit", emoji: "🤸" },
  { id: "aire-libre", label: "Aire libre", emoji: "🏃" },
  { id: "casa", label: "En casa", emoji: "🏠" },
  { id: "funcional", label: "Funcional", emoji: "🧗" },
  { id: "otro", label: "Otro", emoji: "💪" },
];

export const DEFAULT_WORKOUT_TYPE: WorkoutType = "gimnasio";

export function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && WORKOUT_TYPES.some((type) => type.id === value);
}

/** Etiqueta y emoji de un tipo. Cae en "Otro" si el documento trae un tipo que ya no existe en el registro. */
export function workoutTypeMeta(type: WorkoutType): WorkoutTypeMeta {
  return WORKOUT_TYPES.find((entry) => entry.id === type) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1]!;
}

/**
 * Nombres de día aceptados al importar desde JSON, además del número. Es sólo
 * de entrada: adentro siempre se guarda el número de `Date.getDay()`.
 */
const WEEKDAY_NAMES: Record<string, number> = {
  domingo: 0, dom: 0, sunday: 0, sun: 0,
  lunes: 1, lun: 1, monday: 1, mon: 1,
  martes: 2, mar: 2, tuesday: 2, tue: 2,
  miercoles: 3, "miércoles": 3, mie: 3, wednesday: 3, wed: 3,
  jueves: 4, jue: 4, thursday: 4, thu: 4,
  viernes: 5, vie: 5, friday: 5, fri: 5,
  sabado: 6, "sábado": 6, sab: 6, saturday: 6, sat: 6,
};

/**
 * Día de la semana de un valor del JSON importado: un número 0–6 o el nombre
 * del día en castellano/inglés. `null` si no es ninguno de los dos.
 */
export function parseWeekday(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (/^[0-6]$/.test(key)) return Number(key);
    return WEEKDAY_NAMES[key] ?? null;
  }
  return null;
}

/**
 * Orden de la semana arrancando el lunes, que es como se lee un plan de
 * entrenamiento — a diferencia de `Date.getDay()`, que arranca el domingo.
 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Ordena días por semana arrancando el lunes. */
export function sortByWeek<T extends { weekday: number }>(days: T[]): T[] {
  return [...days].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
}

/** Días de la semana en los que la rutina entrena. */
export function routineWeekdays(routine: Pick<WorkoutRoutine, "days">): number[] {
  return routine.days.map((day) => day.weekday);
}

/** Qué toca un día puntual según la rutina, o `null` si ese día es de descanso. */
export function routineDayFor(
  routine: Pick<WorkoutRoutine, "days"> | null,
  day: string
): WorkoutRoutineDay | null {
  if (!routine) return null;
  const weekday = weekdayOf(day);
  return routine.days.find((entry) => entry.weekday === weekday) ?? null;
}

/**
 * Días de entrenamiento consecutivos cumplidos, terminando hoy.
 *
 * A diferencia de `streakOf` (hábitos), acá los días de descanso **no cortan
 * la racha ni suman**: se saltean. Cumplir un plan de lunes/miércoles/viernes
 * durante tres semanas es una racha de 9, aunque entre medio haya sábados sin
 * entrenar. Un día entrenado que no estaba programado tampoco suma — mide
 * cumplimiento del plan, igual criterio que `scheduledWeekCountOf`.
 *
 * Si hoy toca entrenar y todavía no se marcó, la racha se cuenta hasta el día
 * de entrenamiento anterior: el día no terminó, así que no la corta (mismo
 * criterio que `streakOf`).
 *
 * Sin días programados (rutina sin días, o ninguna rutina activa) cae a la
 * racha por días corridos: es lo único que se puede medir sin un plan.
 */
export function workoutStreak(
  doneDates: string[],
  scheduledWeekdays: number[],
  today: string
): number {
  const scheduled = new Set(scheduledWeekdays);
  if (scheduled.size === 0) return streakOf(doneDates, today);

  const done = new Set(doneDates);
  let cursor = scheduled.has(weekdayOf(today)) && !done.has(today) ? shiftDay(today, -1) : today;
  let streak = 0;

  /* Termina siempre: el primer día programado sin marcar corta, y como
     `scheduled` no está vacío nunca pasan más de 7 días sin evaluar uno. */
  for (;;) {
    if (scheduled.has(weekdayOf(cursor))) {
      if (!done.has(cursor)) return streak;
      streak += 1;
    }
    cursor = shiftDay(cursor, -1);
  }
}

/**
 * La racha de entrenamiento más larga de todo el historial, esté activa o no
 * — el récord contra el que se compara la actual.
 *
 * Recorre día por día desde el primer día entrenado hasta el último (las day
 * keys `yyyy-mm-dd` se comparan como strings, que ya es orden cronológico) y
 * cuenta corridas de días programados cumplidos, salteando los de descanso.
 */
export function longestWorkoutStreak(doneDates: string[], scheduledWeekdays: number[]): number {
  const scheduled = new Set(scheduledWeekdays);
  if (scheduled.size === 0) return longestStreakOf(doneDates);

  const done = new Set(doneDates);
  const sorted = Array.from(done).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 0;

  let best = 0;
  let run = 0;
  for (let cursor = first; cursor <= last; cursor = shiftDay(cursor, 1)) {
    if (!scheduled.has(weekdayOf(cursor))) continue;
    run = done.has(cursor) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export interface WorkoutWeekProgress {
  /** Días programados entrenados en los últimos 7 días corridos, hoy incluido. */
  done: number;
  /** Días que la rutina programa por semana. `0` si no hay rutina activa. */
  total: number;
}

/**
 * Progreso de la semana móvil: los últimos 7 días corridos, no la semana
 * calendario — así la meta no se resetea el lunes ni queda a mitad de camino
 * un miércoles (mismo criterio que `weekCountOf` en los hábitos). Como esos 7
 * días cubren cada día de la semana exactamente una vez, el total es
 * directamente la cantidad de días programados.
 */
export function workoutWeekProgress(
  doneDates: string[],
  scheduledWeekdays: number[],
  today: string
): WorkoutWeekProgress {
  const done = new Set(doneDates);
  const scheduled = new Set(scheduledWeekdays);
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = shiftDay(today, -offset);
    if (done.has(day) && scheduled.has(weekdayOf(day))) count += 1;
  }
  return { done: count, total: scheduled.size };
}
