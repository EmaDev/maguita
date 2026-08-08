import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import {
  DEFAULT_EQUIPMENT,
  DEFAULT_MUSCLE_GROUP,
  isEquipment,
  isMuscleGroup,
  type ExerciseInfo,
} from "@/lib/exercise-catalog";

/**
 * Ejercicios propios del usuario (ABM de la biblioteca). El catálogo base no
 * se lee de acá: es estático y vive en `src/lib/exercise-catalog.ts`, así que
 * esta consulta trae sólo lo que el usuario agregó.
 *
 * Se devuelven ya con la forma de `ExerciseInfo` (el mismo tipo del catálogo)
 * para que la pantalla los pueda mezclar con `mergeExercises` sin traducir
 * nada — el `id` es el del documento.
 */
export async function getCustomExercises(userId: string): Promise<ExerciseInfo[]> {
  const snapshot = await collection(COLLECTIONS.customExercises)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .map((data) => ({
      id: data.id,
      name: data.name,
      /* El grupo y el equipamiento se guardan como `string` en Firestore (el
         documento no puede depender de un union de TypeScript). Si un valor
         quedó viejo porque se sacó del registro, cae al default en vez de
         romper el filtro de la biblioteca. */
      group: isMuscleGroup(data.group) ? data.group : DEFAULT_MUSCLE_GROUP,
      equipment: isEquipment(data.equipment) ? data.equipment : DEFAULT_EQUIPMENT,
      description: data.description ?? "",
      tips: data.tips ?? [],
      custom: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
