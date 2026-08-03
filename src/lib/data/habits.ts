import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import type { Habit } from "./home";

/**
 * Hábitos del usuario. Igual que `getLinks`/`getNotes`, filtra sólo por
 * `ownerId` (equality) y ordena en memoria, para no pedirle a Firestore un
 * índice compuesto.
 *
 * El orden es por antigüedad **ascendente**, al revés que notas y links: acá
 * la lista es una checklist que se marca todos los días, y que un hábito
 * nuevo se meta arriba movería de lugar los que el usuario ya tiene
 * memorizados. Con orden de alta, la posición de cada uno no cambia nunca.
 */
export async function getHabits(userId: string): Promise<Habit[]> {
  const snapshot = await collection(COLLECTIONS.habits).where("ownerId", "==", userId).get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
    .map((data) => ({
      id: data.id,
      name: data.name,
      emoji: data.emoji,
      goalPerWeek: data.goalPerWeek,
      /* `doneDates` puede no existir todavía en un hábito recién creado si el
         alta fallara a mitad de camino: la UI hace `.includes()` sobre esto en
         cada render, así que nunca baja `undefined`. */
      doneDates: data.doneDates ?? [],
    }));
}
