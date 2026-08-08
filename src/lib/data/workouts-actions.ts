"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  collection,
  now,
  type WorkoutDayDoc,
  type WorkoutExerciseDoc,
  type WorkoutType,
} from "@/lib/firebase/collections";
import { EXERCISE_CATALOG } from "@/lib/exercise-catalog";
import {
  DEFAULT_WORKOUT_TYPE,
  isWorkoutType,
  parseWeekday,
  sortByWeek,
} from "@/lib/workout-model";

/* ------------------------------------------------------------------ *
 * Topes
 *
 * Todos se validan también en el cliente (`maxLength` de los inputs), pero
 * la Server Action es un endpoint público: es acá donde tienen que valer.
 * ------------------------------------------------------------------ */

const MAX_ROUTINES = 20;
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 140;
const MAX_DAY_TITLE_LENGTH = 60;
const MAX_EXERCISE_NAME_LENGTH = 60;
const MAX_EXERCISE_DETAIL_LENGTH = 40;
const MAX_EXERCISES_PER_DAY = 30;
const MAX_NOTE_LENGTH = 600;

/**
 * Tope del JSON de importación. Un plan de 7 días con 30 ejercicios cada uno
 * entra holgado; sin tope, un pegado enorme se parsearía entero antes de
 * poder rechazarlo por cualquiera de los límites de arriba.
 */
const MAX_IMPORT_LENGTH = 60_000;

/** Cuántas rutinas puede traer un mismo JSON. */
const MAX_IMPORT_ROUTINES = 10;

const orNull = (value: string | null | undefined) => value?.trim() || null;

export interface WorkoutExerciseInput {
  id: string;
  name: string;
  detail: string | null;
  /** Id del ejercicio de la biblioteca (catálogo o propio). `null` = escrito a mano. */
  exerciseId: string | null;
}

export interface WorkoutDayInput {
  weekday: number;
  title: string;
  exercises: WorkoutExerciseInput[];
}

export interface RoutineFieldsInput {
  name: string;
  type: WorkoutType;
  description: string | null;
  days: WorkoutDayInput[];
}

/**
 * Valida y normaliza los ejercicios de un día. Las filas sin nombre se
 * descartan (son las que el usuario abrió en el composer y no llegó a
 * completar), igual criterio que los pasos vacíos de `HabitComposer`.
 *
 * `exerciseId` se guarda tal cual llega, sin verificar que exista en la
 * biblioteca: es sólo procedencia (para poder mostrar descripción y consejos)
 * y el `name` ya viaja copiado, así que un id que no resuelve degrada la
 * fila a "sin ficha" en vez de romperla — que es exactamente lo que pasa
 * cuando el usuario borra un ejercicio propio que ya había usado.
 */
function normalizeExercises(exercises: WorkoutExerciseInput[]): WorkoutExerciseDoc[] {
  const normalized = exercises
    .map((exercise) => ({
      id: exercise.id?.trim() || randomUUID(),
      name: exercise.name.trim(),
      detail: orNull(exercise.detail),
      exerciseId: exercise.exerciseId?.trim() || null,
    }))
    .filter((exercise) => exercise.name);

  if (normalized.length > MAX_EXERCISES_PER_DAY) {
    throw new Error(`Un día no puede tener más de ${MAX_EXERCISES_PER_DAY} ejercicios.`);
  }
  for (const exercise of normalized) {
    if (exercise.name.length > MAX_EXERCISE_NAME_LENGTH) {
      throw new Error(`Un ejercicio no puede tener más de ${MAX_EXERCISE_NAME_LENGTH} caracteres.`);
    }
    if ((exercise.detail?.length ?? 0) > MAX_EXERCISE_DETAIL_LENGTH) {
      throw new Error(`El detalle de un ejercicio no puede tener más de ${MAX_EXERCISE_DETAIL_LENGTH} caracteres.`);
    }
  }

  return normalized;
}

/**
 * Valida y normaliza los días: sin duplicados de `weekday`, con título, y
 * ordenados arrancando el lunes. Los ejercicios de cada día pasan por
 * `normalizeExercises`.
 */
function normalizeDays(days: WorkoutDayInput[]): WorkoutDayDoc[] {
  if (days.length === 0) throw new Error("Elegí al menos un día de entrenamiento.");
  if (days.length > 7) throw new Error("Una rutina no puede tener más de 7 días.");

  const seen = new Set<number>();
  const normalized = days.map((day) => {
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      throw new Error("Alguno de los días no es válido.");
    }
    if (seen.has(day.weekday)) throw new Error("No podés repetir el mismo día de la semana.");
    seen.add(day.weekday);

    const title = day.title.trim();
    if (!title) throw new Error("Poné qué se entrena cada día.");
    if (title.length > MAX_DAY_TITLE_LENGTH) {
      throw new Error(`El título de un día no puede tener más de ${MAX_DAY_TITLE_LENGTH} caracteres.`);
    }

    return { weekday: day.weekday, title, exercises: normalizeExercises(day.exercises) };
  });

  return sortByWeek(normalized);
}

/** Valida los campos comunes al alta, la edición y la importación. */
function normalizeRoutine(input: RoutineFieldsInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Poné un nombre para la rutina.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }
  const description = orNull(input.description);
  if ((description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`La descripción no puede tener más de ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  }
  if (!isWorkoutType(input.type)) throw new Error("Ese tipo de entrenamiento no existe.");

  return { name, description, type: input.type, days: normalizeDays(input.days) };
}

/** Cuántas rutinas tiene el usuario, para el tope de `MAX_ROUTINES`. */
async function countRoutines(userId: string): Promise<number> {
  const existing = await collection(COLLECTIONS.workoutRoutines)
    .where("ownerId", "==", userId)
    .count()
    .get();
  return existing.data().count;
}

/**
 * Trae la rutina y valida dueño en un solo lugar. El Admin SDK saltea
 * `firestore.rules`, así que este chequeo es la única barrera real contra que
 * una sesión válida toque la rutina de otra cuenta pasando su `id` — mismo
 * criterio que `getOwnedHabit`.
 */
async function getOwnedRoutine(routineId: string, ownerId: string) {
  const ref = collection(COLLECTIONS.workoutRoutines).doc(routineId);
  const snapshot = await ref.get();
  const routine = snapshot.data();
  if (!routine || routine.ownerId !== ownerId) {
    throw new Error("Esa rutina ya no existe.");
  }
  return { ref, routine };
}

/**
 * Alta de una rutina. La primera queda activa sola: sin rutina activa la
 * pantalla no puede resolver "qué toca hoy", y obligar a un segundo toque de
 * "Activar" después de crear la única que existe sería un paso vacío.
 */
export async function addRoutineAction(input: RoutineFieldsInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const fields = normalizeRoutine(input);

  const count = await countRoutines(session.sub);
  if (count >= MAX_ROUTINES) {
    throw new Error(`No podés tener más de ${MAX_ROUTINES} rutinas.`);
  }

  await collection(COLLECTIONS.workoutRoutines).add({
    ownerId: session.sub,
    ...fields,
    active: count === 0,
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.miniAppEntrenamiento);
}

export interface UpdateRoutineInput extends RoutineFieldsInput {
  id: string;
}

/**
 * Edita nombre, tipo, descripción y días. No toca `active`: activar es su
 * propia acción porque implica desactivar las demás.
 */
export async function updateRoutineAction(input: UpdateRoutineInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const fields = normalizeRoutine(input);

  const { ref } = await getOwnedRoutine(input.id, session.sub);
  await ref.update({ ...fields, updatedAt: now() });

  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/**
 * Marca una rutina como la activa y desactiva el resto, todo en la misma
 * transacción: así nunca hay una ventana en la que la cuenta tenga dos
 * activas (o ninguna) por dos toques casi simultáneos — mismo criterio que
 * el `status: "active"` único de `expenseCycles`.
 */
export async function activateRoutineAction(routineId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const routines = collection(COLLECTIONS.workoutRoutines);

  await adminDb().runTransaction(async (transaction) => {
    const target = await transaction.get(routines.doc(routineId));
    const data = target.data();
    if (!data || data.ownerId !== session.sub) {
      throw new Error("Esa rutina ya no existe.");
    }

    const mine = await transaction.get(routines.where("ownerId", "==", session.sub));
    const timestamp = now();

    for (const doc of mine.docs) {
      const active = doc.id === routineId;
      if ((doc.data().active ?? false) === active) continue;
      transaction.update(doc.ref, { active, updatedAt: timestamp });
    }
  });

  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/**
 * Borra una rutina. **No borra los días entrenados con ella**: el historial
 * guarda `routineName`/`type` copiados al registrar (ver `WorkoutSessionDoc`),
 * así que sobrevive a la baja igual que un `expenseCycle` cerrado queda como
 * historial. Si la borrada era la activa, la cuenta queda sin ninguna hasta
 * que el usuario active otra — el resto de la pantalla ya contempla ese caso.
 */
export async function deleteRoutineAction(routineId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const { ref } = await getOwnedRoutine(routineId, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/**
 * Suma ejercicios elegidos en la biblioteca a un día de una rutina que ya
 * existe. Es el camino "de la lista a la rutina": desde la biblioteca se
 * seleccionan varios, se elige a qué rutina y a qué día van, y se agregan al
 * final de ese día.
 *
 * Se agregan al final y **no se deduplican** contra lo que el día ya tenía:
 * repetir un ejercicio en la misma sesión es normal (series de aproximación,
 * un circuito que vuelve al mismo movimiento), así que sacarlo en silencio
 * sería decidir por el usuario. El tope por día lo sigue aplicando
 * `normalizeExercises` sobre la lista final.
 */
export async function addExercisesToRoutineDayAction(
  routineId: string,
  weekday: number,
  exercises: WorkoutExerciseInput[]
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  if (exercises.length === 0) throw new Error("Elegí al menos un ejercicio.");

  const { ref, routine } = await getOwnedRoutine(routineId, session.sub);

  const days = routine.days ?? [];
  const target = days.find((day) => day.weekday === weekday);
  if (!target) throw new Error("Ese día no está en la rutina.");

  const nextDays = days.map((day) =>
    day.weekday === weekday
      ? { ...day, exercises: normalizeExercises([...day.exercises, ...exercises]) }
      : day
  );

  await ref.update({ days: nextDays, updatedAt: now() });
  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/* ------------------------------------------------------------------ *
 * Importación desde JSON
 * ------------------------------------------------------------------ */

/**
 * Índice del catálogo por nombre normalizado (sin mayúsculas ni acentos),
 * para engancharle su ficha a un ejercicio importado que vino sólo con el
 * nombre. Se arma una vez por proceso, no en cada importación.
 */
const CATALOG_BY_NAME = new Map(
  EXERCISE_CATALOG.map((exercise) => [normalizeName(exercise.name), exercise.id])
);

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // Rango de marcas diacríticas combinantes: lo que `NFD` separa de la letra base.
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Id del catálogo cuyo nombre coincide con el importado, o `null`. Sin match
 * el ejercicio se guarda igual, sólo que sin ficha — no rechaza la
 * importación por no reconocer un nombre.
 */
function matchCatalogByName(name: string): string | null {
  return CATALOG_BY_NAME.get(normalizeName(name)) ?? null;
}

/** Un valor del JSON sirve como detalle si es texto o número; el resto se ignora. */
const asText = (value: unknown): string | null =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() || null : null;

/**
 * El detalle de un ejercicio importado. `detail` gana si vino; si no, se
 * arma con `sets`/`reps`, que es como lo escriben la mayoría de las apps de
 * entrenamiento: con los dos sale `"4x10"`, con uno solo se usa tal cual.
 */
function parseDetail(exercise: Record<string, unknown>): string | null {
  const detail = asText(exercise.detail);
  if (detail) return detail;

  const sets = asText(exercise.sets);
  const reps = asText(exercise.reps);
  if (sets && reps) return `${sets}x${reps}`;
  return sets ?? reps;
}

/**
 * Lee una rutina del JSON pegado por el usuario, tolerando las formas en que
 * razonablemente puede venir escrita a mano o generada por otra app:
 *
 * - el día como número (`1`) o como nombre (`"lunes"`, `"monday"`);
 * - los ejercicios como objetos (`{ name, detail }`) o como strings sueltos;
 * - `detail` también como `reps`/`sets` (los nombres más habituales).
 *
 * Lo que no se puede interpretar tira un error con el nombre del campo, en
 * vez de importar una rutina a medias en silencio.
 */
function parseRoutine(raw: unknown, index: number): RoutineFieldsInput {
  const where = `rutina ${index + 1}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`La ${where} no es un objeto.`);
  }
  const source = raw as Record<string, unknown>;

  const name = typeof source.name === "string" ? source.name : "";
  if (!name.trim()) throw new Error(`A la ${where} le falta el campo "name".`);

  const type = isWorkoutType(source.type) ? source.type : DEFAULT_WORKOUT_TYPE;
  const description = typeof source.description === "string" ? source.description : null;

  const rawDays = source.days;
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    throw new Error(`A la ${where} le falta el campo "days" con al menos un día.`);
  }

  const days = rawDays.map((rawDay, dayIndex) => {
    const dayWhere = `día ${dayIndex + 1} de la ${where}`;
    if (!rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) {
      throw new Error(`El ${dayWhere} no es un objeto.`);
    }
    const day = rawDay as Record<string, unknown>;

    const weekday = parseWeekday(day.weekday ?? day.day);
    if (weekday === null) {
      throw new Error(`El ${dayWhere} no tiene un "weekday" válido (0–6 o el nombre del día).`);
    }

    const title = typeof day.title === "string" ? day.title : "";
    if (!title.trim()) throw new Error(`Al ${dayWhere} le falta el campo "title".`);

    const rawExercises = Array.isArray(day.exercises) ? day.exercises : [];
    const exercises = rawExercises.map((rawExercise) => {
      if (typeof rawExercise === "string") {
        return {
          id: randomUUID(),
          name: rawExercise,
          detail: null,
          exerciseId: matchCatalogByName(rawExercise),
        };
      }
      if (!rawExercise || typeof rawExercise !== "object") {
        throw new Error(`Un ejercicio del ${dayWhere} no es válido.`);
      }
      const exercise = rawExercise as Record<string, unknown>;
      const exerciseName = typeof exercise.name === "string" ? exercise.name : "";
      if (!exerciseName.trim()) {
        throw new Error(`A un ejercicio del ${dayWhere} le falta el campo "name".`);
      }
      return {
        id: randomUUID(),
        name: exerciseName,
        detail: parseDetail(exercise),
        // Un JSON importado no trae procedencia de la biblioteca: si el
        // ejercicio existe en el catálogo, se resuelve por nombre.
        exerciseId: matchCatalogByName(exerciseName),
      };
    });

    return { weekday, title, exercises };
  });

  return { name, type, description, days };
}

/**
 * Importa una o varias rutinas desde el JSON pegado por el usuario. Acepta un
 * objeto suelto o un array de objetos.
 *
 * Es todo o nada: si alguna de las rutinas del JSON no valida, no se guarda
 * ninguna (se parsean y normalizan todas antes de escribir, y la escritura va
 * en un `WriteBatch`). Importar la mitad de un plan y dejar al usuario
 * adivinando cuáles entraron sería peor que rechazarlo entero.
 *
 * Devuelve cuántas rutinas se importaron, para el mensaje de confirmación.
 */
export async function importRoutinesAction(json: string): Promise<number> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);

  const text = json.trim();
  if (!text) throw new Error("Pegá el JSON de la rutina.");
  if (text.length > MAX_IMPORT_LENGTH) {
    throw new Error("Ese JSON es demasiado grande.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Eso no es un JSON válido. Revisá comas y llaves.");
  }

  /* Además del objeto suelto y el array, se acepta `{ routines: [...] }`:
     es la forma en que sale un export de varias rutinas juntas. */
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).routines)
      ? ((parsed as Record<string, unknown>).routines as unknown[])
      : [parsed];

  if (list.length === 0) throw new Error("El JSON no trae ninguna rutina.");
  if (list.length > MAX_IMPORT_ROUTINES) {
    throw new Error(`No podés importar más de ${MAX_IMPORT_ROUTINES} rutinas de una vez.`);
  }

  const routines = list.map((raw, index) => normalizeRoutine(parseRoutine(raw, index)));

  const count = await countRoutines(session.sub);
  if (count + routines.length > MAX_ROUTINES) {
    throw new Error(`No podés tener más de ${MAX_ROUTINES} rutinas.`);
  }

  const collectionRef = collection(COLLECTIONS.workoutRoutines);
  const batch = adminDb().batch();
  routines.forEach((routine, index) => {
    batch.set(collectionRef.doc(), {
      ownerId: session.sub,
      ...routine,
      // Sin ninguna rutina previa, la primera del lote queda activa — mismo
      // criterio que `addRoutineAction`.
      active: count === 0 && index === 0,
      createdAt: now(),
      updatedAt: now(),
    });
  });
  await batch.commit();

  revalidatePath(ROUTES.miniAppEntrenamiento);
  return routines.length;
}

/* ------------------------------------------------------------------ *
 * Días entrenados
 * ------------------------------------------------------------------ */

/**
 * Valida una day key. El día lo manda el cliente (es *su* día local, el
 * server no conoce su huso), así que no se puede verificar contra el reloj
 * del server — pero sí que sea una fecha real, que es lo que evita ensuciar
 * el historial con strings que después rompan la grilla de constancia.
 * Misma función que `assertValidDay` en `habits-actions.ts`.
 */
function assertValidDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Ese día no es válido.");
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year!, month! - 1, date!);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month! - 1 ||
    parsed.getDate() !== date
  ) {
    throw new Error("Ese día no es válido.");
  }
}

/** Id del registro de un día: `{uid}_{yyyy-mm-dd}`, ver `WorkoutSessionDoc`. */
function sessionId(userId: string, day: string): string {
  return `${userId}_${day}`;
}

export interface LogWorkoutInput {
  /** `yyyy-mm-dd` local del usuario. */
  date: string;
  /** Qué se entrenó. Lo propone el día de la rutina, pero el usuario lo puede cambiar. */
  title: string;
  note: string | null;
  /** Rutina con la que se entrenó. `null` = entrenamiento suelto. */
  routineId: string | null;
}

/**
 * Marca un día como entrenado, o edita el registro de uno ya marcado — es la
 * misma operación: el id del documento se deriva del día
 * (`{uid}_{yyyy-mm-dd}`), así que un `set()` pisa el registro anterior en vez
 * de duplicarlo. Eso lo hace idempotente, que es lo que necesita una UI donde
 * el botón se puede tocar dos veces seguidas.
 *
 * `routineName`/`type` se copian de la rutina al registrar y no se
 * referencian: renombrar o borrar la rutina después no reescribe el
 * historial (mismo criterio que `category` en `expenseMovements`).
 */
export async function logWorkoutAction(input: LogWorkoutInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  assertValidDay(input.date);

  const title = input.title.trim();
  if (!title) throw new Error("Poné qué entrenaste.");
  if (title.length > MAX_DAY_TITLE_LENGTH) {
    throw new Error(`El título no puede tener más de ${MAX_DAY_TITLE_LENGTH} caracteres.`);
  }
  const note = orNull(input.note);
  if ((note?.length ?? 0) > MAX_NOTE_LENGTH) {
    throw new Error(`La nota no puede tener más de ${MAX_NOTE_LENGTH} caracteres.`);
  }

  const routine = input.routineId
    ? (await getOwnedRoutine(input.routineId, session.sub)).routine
    : null;

  const ref = collection(COLLECTIONS.workoutSessions).doc(sessionId(session.sub, input.date));
  const existing = await ref.get();

  await ref.set({
    ownerId: session.sub,
    date: input.date,
    routineId: input.routineId,
    routineName: routine?.name ?? null,
    type: routine?.type ?? DEFAULT_WORKOUT_TYPE,
    title,
    note,
    // Sólo en el alta: editar la nota de un día no debería mover su antigüedad.
    createdAt: existing.data()?.createdAt ?? now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/**
 * Desmarca un día entrenado (y borra su nota). Re-verifica dueño antes de
 * borrar aunque el id ya se derive del `uid` de la sesión: es el mismo
 * criterio que el resto de las Server Actions que tocan documentos con
 * `ownerId`, y no depende de cómo se arme el id.
 */
export async function deleteWorkoutAction(day: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  assertValidDay(day);

  const ref = collection(COLLECTIONS.workoutSessions).doc(sessionId(session.sub, day));
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!data || data.ownerId !== session.sub) {
    throw new Error("Ese día no está registrado.");
  }

  await ref.delete();
  revalidatePath(ROUTES.miniAppEntrenamiento);
}
