import "server-only";
import { COLLECTIONS, collection, withId, type WorkoutType } from "@/lib/firebase/collections";

/**
 * Rutinas y días entrenados de la mini-app privada de entrenamiento
 * (`/mini-apps/entrenamiento`).
 */

export interface WorkoutExercise {
  /** Id de la fila dentro de la rutina, no del ejercicio de la biblioteca. */
  id: string;
  name: string;
  /** Series/repeticiones/tiempo como texto libre, ej. "4x10". `null` = sin detalle. */
  detail: string | null;
  /** Ejercicio de la biblioteca del que salió (catálogo o propio). `null` = escrito a mano. */
  exerciseId: string | null;
}

export interface WorkoutRoutineDay {
  /** `Date.getDay()`: 0 = domingo … 6 = sábado. Único dentro de la rutina. */
  weekday: number;
  title: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  type: WorkoutType;
  description: string | null;
  days: WorkoutRoutineDay[];
  /** Rutina con la que se resuelve "qué toca hoy". Sólo una por cuenta. */
  active: boolean;
  /** Milisegundos: un `Timestamp` de Firestore no serializa a un Client Component. */
  createdAt: number;
}

export interface WorkoutSession {
  /** `yyyy-mm-dd`. Es la clave real del registro: hay a lo sumo uno por día. */
  date: string;
  routineId: string | null;
  routineName: string | null;
  type: WorkoutType;
  title: string;
  note: string | null;
}

/**
 * Rutinas del usuario, la activa primero y después por antigüedad. Filtra
 * sólo por `ownerId` (equality) y ordena en memoria — mismo criterio que
 * `getLinks`/`getHabits`, evita pedirle a Firestore un índice compuesto.
 */
export async function getWorkoutRoutines(userId: string): Promise<WorkoutRoutine[]> {
  const snapshot = await collection(COLLECTIONS.workoutRoutines)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .map((data) => ({
      id: data.id,
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      days: (data.days ?? []).map((day) => ({
        weekday: day.weekday,
        title: day.title,
        exercises: (day.exercises ?? []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          detail: exercise.detail ?? null,
          // `??` cubre las filas cargadas antes de que existiera la biblioteca.
          exerciseId: exercise.exerciseId ?? null,
        })),
      })),
      active: data.active ?? false,
      createdAt: data.createdAt?.toMillis() ?? 0,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.createdAt - b.createdAt);
}

/**
 * Días entrenados del usuario, más reciente primero.
 *
 * Se traen todos y no una ventana de fechas: la grilla de constancia y el
 * récord histórico necesitan el historial completo, y son ~150 documentos por
 * año de entrenamiento — el mismo orden de magnitud que las notas.
 */
export async function getWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const snapshot = await collection(COLLECTIONS.workoutSessions)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data())
    .map((data) => ({
      date: data.date,
      routineId: data.routineId ?? null,
      routineName: data.routineName ?? null,
      type: data.type,
      title: data.title,
      note: data.note ?? null,
    }))
    /* Las day keys `yyyy-mm-dd` son lexicográficas, así que ordenarlas como
       strings ya es ordenarlas cronológicamente. */
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
