"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, collection, now, type ExpenseCategoryItem } from "@/lib/firebase/collections";
import { DEFAULT_EXPENSE_CATEGORIES } from "./expense-categories";

/**
 * ABM de categorías del gestor de gastos. Un solo documento por usuario
 * (`expenseCategories/{uid}`) con el array entero, igual que `favorites`:
 * son pocas categorías, así que una lectura gana contra N de una subcolección
 * y el alta/edición/borrado es siempre read-modify-write de todo el array.
 */

export interface UpsertExpenseCategoryInput {
  /** Presente = editar esa categoría; ausente = crear una nueva. */
  id?: string;
  name: string;
  emoji: string;
}

/** Crea o edita una categoría y devuelve el array completo ya actualizado. */
export async function upsertExpenseCategoryAction(
  input: UpsertExpenseCategoryInput
): Promise<ExpenseCategoryItem[]> {
  const session = await requireSession(ROUTES.inicio);

  const name = input.name.trim();
  const emoji = input.emoji.trim();
  if (!name) throw new Error("El nombre no puede estar vacío.");
  if (!emoji) throw new Error("Elegí un emoji para la categoría.");

  const ref = collection(COLLECTIONS.expenseCategories).doc(session.sub);

  const next = await adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.categories ?? DEFAULT_EXPENSE_CATEGORIES;

    const updated: ExpenseCategoryItem[] = input.id
      ? current.map((category) =>
          category.id === input.id ? { ...category, name, emoji } : category
        )
      : [...current, { id: randomUUID(), name, emoji }];

    // `merge` para que el documento se cree solo la primera vez.
    transaction.set(ref, { categories: updated, updatedAt: now() }, { merge: true });
    return updated;
  });

  revalidatePath(ROUTES.inicio);
  return next;
}

/** Borra una categoría y devuelve el array completo ya actualizado. */
export async function deleteExpenseCategoryAction(
  categoryId: string
): Promise<ExpenseCategoryItem[]> {
  const session = await requireSession(ROUTES.inicio);
  const ref = collection(COLLECTIONS.expenseCategories).doc(session.sub);

  const next = await adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.categories ?? DEFAULT_EXPENSE_CATEGORIES;
    const updated = current.filter((category) => category.id !== categoryId);

    transaction.set(ref, { categories: updated, updatedAt: now() }, { merge: true });
    return updated;
  });

  revalidatePath(ROUTES.inicio);
  return next;
}
