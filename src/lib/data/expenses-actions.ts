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
import { formatMoney } from "@/lib/home-model";
import { notifyQuietly } from "@/lib/notifications/notify";
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
  const [cycle, categoriesSnapshot] = await Promise.all([
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

  await notifyExpenseLimit(session.sub, input.cycleId, cycle);

  revalidatePath(ROUTES.inicio);
}

/**
 * Umbrales del tope, de mayor a menor. El aviso sale una sola vez por umbral y
 * por ciclo: la `dedupeKey` de `notify()` lo garantiza, si no cada gasto
 * cargado después de pasar el 80% volvería a avisar lo mismo.
 *
 * Se recorre de mayor a menor y se corta en el primero que se cumple: un gasto
 * que salta del 70% al 120% de una avisa "te pasaste", no "vas por el 80%".
 */
const EXPENSE_LIMIT_THRESHOLDS = [
  {
    key: "over",
    ratio: 1,
    title: "Te pasaste del tope",
    body: (spent: number, limit: number) =>
      `Llevás ${formatMoney(spent)} gastados de un tope de ${formatMoney(limit)}.`,
  },
  {
    key: "80",
    ratio: 0.8,
    title: "Vas por el 80% del tope",
    body: (spent: number, limit: number) =>
      `Llevás ${formatMoney(spent)} de ${formatMoney(limit)} en este período.`,
  },
] as const;

/**
 * Avisa cuando el gasto acumulado del ciclo cruza un umbral del tope.
 *
 * Cuesta una consulta de los movimientos del ciclo (los mismos que la pantalla
 * va a leer enseguida al revalidar), que es el precio de no llevar el
 * acumulado como campo del ciclo — un contador que habría que mantener
 * sincronizado en cada alta y en cada baja, y que se desincroniza en el primer
 * error a mitad de camino.
 *
 * Va con `notifyQuietly`: el gasto ya se guardó, y que falle el aviso no puede
 * hacer fallar el alta que el usuario pidió.
 */
async function notifyExpenseLimit(
  userId: string,
  cycleId: string,
  cycle: ExpenseCycleDoc
): Promise<void> {
  if (cycle.expenseLimit <= 0) return;

  const snapshot = await collection(COLLECTIONS.expenseMovements)
    .where("cycleId", "==", cycleId)
    .get();

  const spent = snapshot.docs.reduce((total, doc) => {
    const { amount } = doc.data();
    return total + (amount < 0 ? -amount : 0);
  }, 0);

  const crossed = EXPENSE_LIMIT_THRESHOLDS.find(
    (threshold) => spent >= cycle.expenseLimit * threshold.ratio
  );
  if (!crossed) return;

  await notifyQuietly({
    userId,
    topic: "expenses.limit-reached",
    title: crossed.title,
    description: crossed.body(spent, cycle.expenseLimit),
    href: ROUTES.inicio,
    dedupeKey: `${cycleId}:${crossed.key}`,
  });
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
