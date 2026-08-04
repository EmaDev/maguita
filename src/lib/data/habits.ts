import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import type { Habit } from "./home";

/**
 * Hábitos del usuario. Igual que `getLinks`/`getNotes`, filtra sólo por
 * `ownerId` (equality) y ordena en memoria, para no pedirle a Firestore un
 * índice compuesto.
 *
 * El orden es manual (`order`, drag & drop en `HabitsPanel`). Un hábito
 * cargado antes de que `order` existiera cae a su `createdAt` — mismo
 * criterio de antigüedad ascendente que regía antes, así que no salta de
 * lugar hasta que el usuario arrastre la lista por primera vez (ahí
 * `reorderHabitsAction` le escribe un `order` a todos los suyos de una).
 */
export async function getHabits(userId: string): Promise<Habit[]> {
  const snapshot = await collection(COLLECTIONS.habits).where("ownerId", "==", userId).get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .sort(
      (a, b) =>
        (a.order ?? a.createdAt?.toMillis() ?? 0) - (b.order ?? b.createdAt?.toMillis() ?? 0)
    )
    .map((data) => ({
      id: data.id,
      name: data.name,
      subtitle: data.subtitle ?? null,
      emoji: data.emoji,
      /* `doneDates` puede no existir todavía en un hábito recién creado si el
         alta fallara a mitad de camino: la UI hace `.includes()` sobre esto en
         cada render, así que nunca baja `undefined`. */
      doneDates: data.doneDates ?? [],
      scheduledWeekdays: data.scheduledWeekdays ?? [],
      alertEnabled: data.alertEnabled ?? false,
      alertTime: data.alertTime ?? null,
      score: data.score ?? 0,
      order: data.order ?? data.createdAt?.toMillis() ?? 0,
      /* El cliente nunca ve la forma de mapa cruda (`actionDoneDates`): acá
         se resuelve contra cada acción para que la UI sólo trate con
         `HabitAction.doneDates`, igual forma que `Habit.doneDates`. */
      actions: (data.actions ?? []).map((action) => ({
        id: action.id,
        name: action.name,
        doneDates: data.actionDoneDates?.[action.id] ?? [],
      })),
    }));
}
