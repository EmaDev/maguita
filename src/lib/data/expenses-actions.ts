"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  collection,
  now,
  type ExpenseCycleDoc,
} from "@/lib/firebase/collections";
import { DEFAULT_EXPENSE_CATEGORIES } from "./expense-categories";
import { getClosedExpenseCycles, type ExpensePeriodSummary } from "./expenses";

/**
 * Trae el ciclo y valida dueño + `status: "active"` en un solo lugar: lo
 * usan todas las altas/ediciones de un ciclo en uso (agregar un movimiento,
 * cambiar tope o fechas). No sólo lo pide Firestore rules: el Admin SDK las
 * saltea, así que este chequeo es la única barrera real contra que una
 * sesión válida toque el ciclo de otra cuenta pasando su `cycleId`.
 */
async function getOwnedActiveCycle(cycleId: string, ownerId: string): Promise<ExpenseCycleDoc> {
  const snapshot = await collection(COLLECTIONS.expenseCycles).doc(cycleId).get();
  const cycle = snapshot.data();
  if (!cycle || cycle.ownerId !== ownerId || cycle.status !== "active") {
    throw new Error("El período de gastos ya no está activo.");
  }
  return cycle;
}

/**
 * Altas del gestor de gastos. Re-verifican la sesión porque una Server Action
 * es un endpoint público, igual que `favorites-actions.ts`.
 */

export interface StartExpenseCycleInput {
  /** Libre ("Gastos vacaciones Ushuaia"). Vacío/ausente = sin título, la UI muestra el lapso de fechas. */
  title?: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  expenseLimit: number;
}

/**
 * Cierra el ciclo `active` del usuario (si hay uno) y crea el nuevo, en una
 * sola transacción: así nunca queda más de un ciclo activo, y el anterior
 * queda como historial (`status: "closed"`) en vez de borrarse.
 */
export async function startExpenseCycleAction(input: StartExpenseCycleInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
    throw new Error("El rango de fechas no es válido.");
  }
  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    throw new Error("El saldo inicial no es válido.");
  }
  if (!Number.isFinite(input.expenseLimit) || input.expenseLimit <= 0) {
    throw new Error("El tope de gastos no es válido.");
  }

  const title = input.title?.trim() || null;
  const cycles = collection(COLLECTIONS.expenseCycles);

  await adminDb().runTransaction(async (transaction) => {
    const activeSnapshot = await transaction.get(
      cycles.where("ownerId", "==", session.sub).where("status", "==", "active")
    );
    const timestamp = now();

    for (const doc of activeSnapshot.docs) {
      transaction.update(doc.ref, {
        status: "closed",
        closedAt: timestamp,
        updatedAt: timestamp,
      });
    }

    transaction.set(cycles.doc(), {
      ownerId: session.sub,
      title,
      startDate: input.startDate,
      endDate: input.endDate,
      initialBalance: input.initialBalance,
      expenseLimit: input.expenseLimit,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: null,
    });
  });

  revalidatePath(ROUTES.inicio);
}

export interface AddExpenseMovementInput {
  cycleId: string;
  title: string;
  /** Id de una de las categorías del ABM del usuario (`expenseCategories/{uid}`). */
  categoryId: string;
  amount: number;
  date: string;
}

/**
 * Carga un gasto dentro de un ciclo. El monto se manda siempre positivo y acá
 * se lo pasa a negativo: esta alta es sólo de gastos (ver `Movement.amount`).
 * `title` es el concepto que tipeó el usuario; si lo dejó vacío (es
 * opcional), el sheet ya lo completó con el nombre de la categoría antes de
 * llamar acá.
 */
export async function addExpenseMovementAction(input: AddExpenseMovementInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  const title = input.title.trim();
  const amount = Math.abs(input.amount);
  if (!title || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Revisá el monto y el concepto del gasto.");
  }

  const categoriesRef = collection(COLLECTIONS.expenseCategories).doc(session.sub);
  const [, categoriesSnapshot] = await Promise.all([
    getOwnedActiveCycle(input.cycleId, session.sub),
    categoriesRef.get(),
  ]);

  // El nombre y el emoji se resuelven acá (no se confía en lo que mande el
  // cliente) y quedan copiados en el movimiento: si la categoría se edita o
  // se borra después, este gasto sigue mostrando lo que mostraba al cargarse.
  const categories = categoriesSnapshot.data()?.categories ?? DEFAULT_EXPENSE_CATEGORIES;
  const category = categories.find((item) => item.id === input.categoryId);
  if (!category) {
    throw new Error("Elegí una categoría válida.");
  }

  await collection(COLLECTIONS.expenseMovements).add({
    cycleId: input.cycleId,
    ownerId: session.sub,
    title,
    category: category.name,
    categoryEmoji: category.emoji,
    amount: -amount,
    date: input.date,
    createdAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/** Categoría fija de los ingresos: no pasan por el ABM de categorías de gasto. */
const INCOME_CATEGORY = { name: "Ingreso", emoji: "💰" } as const;

export interface AddExpenseIncomeInput {
  cycleId: string;
  title: string;
  amount: number;
  date: string;
}

/**
 * Carga un ingreso dentro de un ciclo. A diferencia de un gasto, el monto se
 * guarda positivo y no pide categoría — el "Nuevo ingreso" es un alta más
 * simple, pensada para sueldo/transferencias/repuestos de saldo.
 */
export async function addExpenseIncomeAction(input: AddExpenseIncomeInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  const title = input.title.trim() || INCOME_CATEGORY.name;
  const amount = Math.abs(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Revisá el monto del ingreso.");
  }

  await getOwnedActiveCycle(input.cycleId, session.sub);

  await collection(COLLECTIONS.expenseMovements).add({
    cycleId: input.cycleId,
    ownerId: session.sub,
    title,
    category: INCOME_CATEGORY.name,
    categoryEmoji: INCOME_CATEGORY.emoji,
    amount,
    date: input.date,
    createdAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

export interface UpdateExpenseCycleInput {
  cycleId: string;
  /** Vacío = borra el título (`null`), la UI vuelve a mostrar el lapso de fechas. */
  title?: string;
  startDate: string;
  endDate: string;
  expenseLimit: number;
}

/**
 * Cambia el título, el tope de gastos y/o el lapso de fechas de un ciclo ya
 * en curso, sin cerrarlo ni tocar sus movimientos — a diferencia de
 * `startExpenseCycleAction` ("Finalizar"), que cierra el actual y arranca
 * uno nuevo, mandando el primero al historial. El saldo inicial queda
 * afuera a propósito: cambiarlo a mitad de período resignificaría los
 * gastos ya cargados contra un punto de partida distinto al que tenían
 * cuando se cargaron.
 */
export async function updateExpenseCycleAction(input: UpdateExpenseCycleInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
    throw new Error("El rango de fechas no es válido.");
  }
  if (!Number.isFinite(input.expenseLimit) || input.expenseLimit <= 0) {
    throw new Error("El tope de gastos no es válido.");
  }

  await getOwnedActiveCycle(input.cycleId, session.sub);

  await collection(COLLECTIONS.expenseCycles).doc(input.cycleId).update({
    title: input.title?.trim() || null,
    startDate: input.startDate,
    endDate: input.endDate,
    expenseLimit: input.expenseLimit,
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/**
 * Períodos cerrados del usuario, para el carrusel "Períodos anteriores" de
 * `MovementsPanel`. Es una lectura, no una escritura, pero igual necesita
 * ser una Server Action: el componente la llama bajo demanda (al desplegar
 * el dropdown), y `lib/data/expenses.ts` es `server-only` — no se puede
 * importar directo desde un Client Component.
 */
export async function getPastExpenseCyclesAction(): Promise<ExpensePeriodSummary[]> {
  const session = await requireSession(ROUTES.inicio);
  return getClosedExpenseCycles(session.sub);
}
