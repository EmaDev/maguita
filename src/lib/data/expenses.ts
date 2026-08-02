import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import { byDayDesc } from "@/lib/home-model";
import type { Movement } from "./home";

/**
 * Gestor de gastos de la tab Movimientos: períodos con saldo inicial y tope,
 * y los movimientos cargados dentro de cada uno.
 *
 * Versión simplificada de lo que será una mini-app aparte más adelante, que
 * va a leer las mismas colecciones (`expenseCycles` / `expenseMovements`) —
 * por eso viven en `lib/data` y no adentro de `components/organisms/home`.
 */

export type ExpenseCycleStatus = "active" | "closed";

export interface ExpenseCycle {
  id: string;
  /** `null` = sin título propio; la UI cae al lapso de fechas (`formatDateRangeShort`). */
  title: string | null;
  startDate: string;
  endDate: string;
  initialBalance: number;
  expenseLimit: number;
  status: ExpenseCycleStatus;
}

/**
 * El ciclo `active` del usuario, si hay uno. Sólo puede haber uno a la vez
 * (lo garantiza `startExpenseCycleAction`), así que alcanza con `limit(1)`.
 */
export async function getActiveExpenseCycle(userId: string): Promise<ExpenseCycle | null> {
  const snapshot = await collection(COLLECTIONS.expenseCycles)
    .where("ownerId", "==", userId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;

  const data = withId(doc);
  return {
    id: data.id,
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    initialBalance: data.initialBalance,
    expenseLimit: data.expenseLimit,
    status: data.status,
  };
}

/**
 * Un ciclo puntual por id — para la pantalla de detalle de un período
 * (`/inicio/periodos/{cycleId}`), a la que se llega desde el carrusel de
 * "Períodos anteriores" o, a futuro, un link compartido. Verifica dueño acá
 * (no sólo en las reglas, que el Admin SDK saltea): `null` tanto si el
 * documento no existe como si es de otra cuenta, así el caller no puede
 * distinguir "no existe" de "no es tuyo" y usa `notFound()` en los dos casos.
 */
export async function getExpenseCycleById(
  userId: string,
  cycleId: string
): Promise<ExpenseCycle | null> {
  const snapshot = await collection(COLLECTIONS.expenseCycles).doc(cycleId).get();
  const data = snapshot.data();
  if (!data || data.ownerId !== userId) return null;

  return {
    id: snapshot.id,
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    initialBalance: data.initialBalance,
    expenseLimit: data.expenseLimit,
    status: data.status,
  };
}

/**
 * Movimientos de un ciclo, más reciente primero. Filtra sólo por `cycleId`
 * (una equality) y ordena en memoria con `byDayDesc`: agregar un `orderBy`
 * distinto al filtro le pediría un índice compuesto a Firestore que hoy no
 * hace falta.
 */
export async function getExpenseMovements(cycleId: string): Promise<Movement[]> {
  const snapshot = await collection(COLLECTIONS.expenseMovements)
    .where("cycleId", "==", cycleId)
    .get();

  const movements = snapshot.docs.map((doc) => {
    const data = withId(doc);
    return {
      id: data.id,
      title: data.title,
      category: data.category,
      categoryEmoji: data.categoryEmoji,
      amount: data.amount,
      date: data.date,
    };
  });

  return byDayDesc(movements);
}

/** Cuántos ciclos cerrados trae `getClosedExpenseCycles`: alcanza para un carrusel, sin crecer sin límite. */
const MAX_PAST_CYCLES = 10;

export interface ExpensePeriodSummary {
  id: string;
  title: string | null;
  startDate: string;
  endDate: string;
  initialBalance: number;
  expenseLimit: number;
  /** Total gastado en el ciclo, en positivo. */
  spent: number;
  /** Total ingresado en el ciclo, en positivo. */
  income: number;
}

/**
 * Períodos cerrados del usuario (historial), más reciente primero, con el
 * total gastado/ingresado de cada uno. Pensada para pedirse bajo demanda (al
 * desplegar el carrusel de "Períodos anteriores" en `MovementsPanel`), no en
 * el fetch inicial de la pantalla — la mayoría de las visitas no la abren.
 */
export async function getClosedExpenseCycles(userId: string): Promise<ExpensePeriodSummary[]> {
  const cyclesSnapshot = await collection(COLLECTIONS.expenseCycles)
    .where("ownerId", "==", userId)
    .where("status", "==", "closed")
    .limit(MAX_PAST_CYCLES)
    .get();

  const cycles = cyclesSnapshot.docs.map((doc) => withId(doc));
  if (cycles.length === 0) return [];

  // Un solo `in` en vez de N consultas (una por ciclo): el cap de arriba
  // mantiene el array bien por debajo del máximo de 30 valores que acepta.
  const movementsSnapshot = await collection(COLLECTIONS.expenseMovements)
    .where(
      "cycleId",
      "in",
      cycles.map((cycle) => cycle.id)
    )
    .get();

  const totals = new Map<string, { spent: number; income: number }>();
  for (const doc of movementsSnapshot.docs) {
    const movement = doc.data();
    const current = totals.get(movement.cycleId) ?? { spent: 0, income: 0 };
    if (movement.amount < 0) current.spent += -movement.amount;
    else current.income += movement.amount;
    totals.set(movement.cycleId, current);
  }

  return cycles
    .map((cycle) => {
      const { spent, income } = totals.get(cycle.id) ?? { spent: 0, income: 0 };
      return {
        id: cycle.id,
        title: cycle.title,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        initialBalance: cycle.initialBalance,
        expenseLimit: cycle.expenseLimit,
        spent,
        income,
      };
    })
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}
