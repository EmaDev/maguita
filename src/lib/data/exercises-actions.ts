"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { COLLECTIONS, collection, now } from "@/lib/firebase/collections";
import {
  isEquipment,
  isMuscleGroup,
  type ExerciseEquipment,
  type MuscleGroup,
} from "@/lib/exercise-catalog";

/**
 * ABM de los ejercicios propios del usuario. El catálogo base es estático y
 * no se toca desde acá: estas acciones sólo escriben `customExercises`, que
 * es lo que después se mezcla con el catálogo en la biblioteca.
 */

/**
 * Tope de ejercicios propios por cuenta. La biblioteca los baja todos juntos
 * en cada carga de la pantalla (no hay paginado), así que el límite es lo que
 * evita que una cuenta convierta esa lectura en algo pesado.
 */
const MAX_CUSTOM_EXERCISES = 200;

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TIPS = 8;
const MAX_TIP_LENGTH = 200;

export interface CustomExerciseInput {
  name: string;
  group: MuscleGroup;
  equipment: ExerciseEquipment;
  description: string | null;
  /** Consejos ya separados por línea. Los vacíos se descartan. */
  tips: string[];
}

/** Valida y normaliza los campos comunes al alta y a la edición. */
function normalizeExercise(input: CustomExerciseInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Poné un nombre para el ejercicio.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }
  if (!isMuscleGroup(input.group)) throw new Error("Ese grupo muscular no existe.");
  if (!isEquipment(input.equipment)) throw new Error("Ese equipamiento no existe.");

  const description = input.description?.trim() || null;
  if ((description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`La descripción no puede tener más de ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  }

  // Los consejos en blanco son líneas que el usuario dejó vacías en el
  // textarea, no consejos: se descartan en vez de guardarse como `""`.
  const tips = input.tips.map((tip) => tip.trim()).filter(Boolean);
  if (tips.length > MAX_TIPS) {
    throw new Error(`No podés cargar más de ${MAX_TIPS} consejos.`);
  }
  if (tips.some((tip) => tip.length > MAX_TIP_LENGTH)) {
    throw new Error(`Un consejo no puede tener más de ${MAX_TIP_LENGTH} caracteres.`);
  }

  return { name, group: input.group, equipment: input.equipment, description, tips };
}

/**
 * Trae el ejercicio y valida dueño en un solo lugar. El Admin SDK saltea
 * `firestore.rules`, así que este chequeo es la única barrera real contra que
 * una sesión válida edite el ejercicio de otra cuenta pasando su `id` —
 * mismo criterio que `getOwnedRoutine`.
 */
async function getOwnedExercise(exerciseId: string, ownerId: string) {
  const ref = collection(COLLECTIONS.customExercises).doc(exerciseId);
  const snapshot = await ref.get();
  const exercise = snapshot.data();
  if (!exercise || exercise.ownerId !== ownerId) {
    throw new Error("Ese ejercicio ya no existe.");
  }
  return { ref, exercise };
}

/** Alta de un ejercicio propio. Devuelve su id, para poder seleccionarlo apenas se crea. */
export async function addCustomExerciseAction(input: CustomExerciseInput): Promise<string> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const fields = normalizeExercise(input);

  const exercises = collection(COLLECTIONS.customExercises);
  const existing = await exercises.where("ownerId", "==", session.sub).count().get();
  if (existing.data().count >= MAX_CUSTOM_EXERCISES) {
    throw new Error(`No podés tener más de ${MAX_CUSTOM_EXERCISES} ejercicios propios.`);
  }

  const ref = await exercises.add({
    ownerId: session.sub,
    ...fields,
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.miniAppEntrenamiento);
  return ref.id;
}

export interface UpdateCustomExerciseInput extends CustomExerciseInput {
  id: string;
}

/**
 * Edita un ejercicio propio. **No actualiza las rutinas que lo usan**: el
 * nombre se copia a la fila de la rutina al elegirlo (ver
 * `WorkoutExerciseDoc.name`), así que renombrar acá no reescribe planes ya
 * armados — mismo criterio que `category` en `expenseMovements`. La
 * descripción y los consejos sí se ven actualizados desde la rutina, porque
 * esos se resuelven por `exerciseId` en cada render.
 */
export async function updateCustomExerciseAction(
  input: UpdateCustomExerciseInput
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const fields = normalizeExercise(input);

  const { ref } = await getOwnedExercise(input.id, session.sub);
  await ref.update({ ...fields, updatedAt: now() });

  revalidatePath(ROUTES.miniAppEntrenamiento);
}

/**
 * Borra un ejercicio propio. Las rutinas que lo usaban **no se tocan**:
 * conservan el nombre copiado y quedan con un `exerciseId` que ya no
 * resuelve, así que dejan de mostrar descripción y consejos pero el plan
 * sigue completo. Es el mismo criterio que borrar una rutina sin borrar su
 * historial de días entrenados.
 */
export async function deleteCustomExerciseAction(exerciseId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const { ref } = await getOwnedExercise(exerciseId, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.miniAppEntrenamiento);
}
