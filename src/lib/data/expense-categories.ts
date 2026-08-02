import "server-only";
import { COLLECTIONS, collection, type ExpenseCategoryItem } from "@/lib/firebase/collections";

export type { ExpenseCategoryItem };

/**
 * Set inicial de categorías: se usa mientras el usuario no tiene
 * `expenseCategories/{uid}` propio (nunca hizo ningún alta/edición/borrado
 * todavía), así el selector de categorías del alta de gastos no arranca
 * vacío. En cuanto el usuario toca el ABM por primera vez, este set pasa a
 * ser la base sobre la que se aplica ese primer cambio (ver
 * `upsertExpenseCategoryAction` / `deleteExpenseCategoryAction`).
 */
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { id: "comida", name: "Comida", emoji: "🍔" },
  { id: "transporte", name: "Transporte", emoji: "🚌" },
  { id: "compras", name: "Compras", emoji: "🛍️" },
  { id: "servicios", name: "Servicios", emoji: "🧾" },
  { id: "entretenimiento", name: "Entretenimiento", emoji: "🎬" },
  { id: "salud", name: "Salud", emoji: "💊" },
  { id: "otros", name: "Otros", emoji: "✨" },
];

/** Categorías del ABM del usuario, o el set por default si todavía no armó ninguna. */
export async function getExpenseCategories(userId: string): Promise<ExpenseCategoryItem[]> {
  const snapshot = await collection(COLLECTIONS.expenseCategories).doc(userId).get();
  return snapshot.data()?.categories ?? DEFAULT_EXPENSE_CATEGORIES;
}
