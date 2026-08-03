import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import { byDayDesc } from "@/lib/home-model";
import type { Note } from "./home";

/**
 * Notas de la tab Notas: alta libre con prioridad y alerta opcional
 * (fecha/hora propias, distintas de `date`).
 */

/**
 * Notas del usuario, más reciente primero. Filtra sólo por `ownerId`
 * (equality) y ordena en memoria con `byDayDesc`, igual que
 * `getExpenseMovements` — evita pedirle a Firestore un índice compuesto.
 */
export async function getNotes(userId: string): Promise<Note[]> {
  const snapshot = await collection(COLLECTIONS.notes)
    .where("ownerId", "==", userId)
    .get();

  const notes = snapshot.docs.map((doc) => {
    const data = withId(doc);
    return {
      id: data.id,
      text: data.text,
      date: data.date,
      priority: data.priority,
      hasAlert: data.hasAlert,
      alertDate: data.alertDate,
      alertTime: data.alertTime,
    };
  });

  return byDayDesc(notes);
}
