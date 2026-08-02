import type { Habit, Movement } from "@/lib/data/home";
import type { ExpenseCycle } from "@/lib/data/expenses";

/**
 * Cálculos y formato de la pantalla de Inicio. Funciones puras, sin `"use
 * client"` ni `"server-only"`: las usan tanto el seed del server como los
 * paneles del cliente, y así los dos derivan los mismos números.
 *
 * Todas las fechas son *day keys* (`yyyy-mm-dd`) construidas con los getters
 * locales, nunca con `toISOString()` — que pasa a UTC y corre el día para
 * cualquiera al oeste de Greenwich.
 */

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Day key de un timestamp (`Date.now()` de los borradores locales). */
export function dayKeyOf(timestamp: number): string {
  return dayKey(new Date(timestamp));
}

/**
 * Convierte una day key en `Date` al mediodía local: a las 00:00 un cambio de
 * horario de verano puede devolver el día anterior.
 */
export function parseDay(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

/** Mueve una day key `days` días (negativo = hacia atrás). */
export function shiftDay(key: string, days: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "Hoy" / "Ayer" / "12 jul" — mismo criterio que el agrupado de TransactionList. */
export function formatDay(key: string, today: string): string {
  if (key === today) return "Hoy";
  if (key === shiftDay(today, -1)) return "Ayer";
  const date = parseDay(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "dd/mm" de una day key — recorta el string directo, sin pasar por `Date`. */
export function formatShortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** "01/08 al 31/08" — lapso de un ciclo del gestor de gastos, para cuando no tiene título propio. */
export function formatDateRangeShort(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)} al ${formatShortDate(endDate)}`;
}

/** Título de un ciclo: el que puso el usuario, o su lapso de fechas si no definió ninguno. */
export function expenseCycleTitle(
  cycle: Pick<ExpenseCycle, "title" | "startDate" | "endDate">
): string {
  return cycle.title?.trim() || formatDateRangeShort(cycle.startDate, cycle.endDate);
}

/**
 * Formato de moneda hecho a mano sobre `toLocaleString`, no con
 * `Intl.NumberFormat(style: "currency")`: el símbolo y el espacio que mete cada
 * runtime varían entre Node y el browser, y eso es un mismatch de hidratación.
 */
export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("es-AR")}`;
}

/** Igual que `formatMoney` pero explicitando el `+` de los ingresos. */
export function formatSignedMoney(amount: number): string {
  const rounded = Math.round(amount);
  return rounded > 0 ? `+${formatMoney(rounded)}` : formatMoney(rounded);
}

/**
 * Días consecutivos cumplidos terminando hoy. Si hoy todavía no se marcó, la
 * racha se cuenta hasta ayer: el día no terminó, así que no la corta.
 */
export function streakOf(doneDates: string[], today: string): number {
  const done = new Set(doneDates);
  let cursor = done.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export interface HabitsToday {
  done: number;
  total: number;
  /** La racha más larga entre todos los hábitos. */
  bestStreak: number;
}

export function habitsToday(habits: Habit[], today: string): HabitsToday {
  return {
    done: habits.filter((habit) => habit.doneDates.includes(today)).length,
    total: habits.length,
    bestStreak: habits.reduce(
      (best, habit) => Math.max(best, streakOf(habit.doneDates, today)),
      0
    ),
  };
}

/** Más reciente primero; a igual día, el orden original (el seed ya viene ordenado). */
export function byDayDesc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface ExpenseCycleProgress {
  /** Total gastado en el ciclo, en positivo. */
  spent: number;
  /** Total de ingresos cargados en el ciclo, en positivo. */
  income: number;
  /** Saldo inicial + ingresos − gastos. Puede ser negativo. */
  remaining: number;
  /** `spent / expenseLimit` en 0–100, saturado. */
  pct: number;
  over: boolean;
  /** `today` es posterior a `endDate`. */
  ended: boolean;
  /** Días hasta `endDate`, 0 si ya terminó. */
  daysLeft: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gastado, ingresado, saldo restante y % del tope de un ciclo, a partir de sus movimientos. */
export function expenseCycleProgress(
  cycle: Pick<ExpenseCycle, "initialBalance" | "expenseLimit" | "endDate">,
  movements: Movement[],
  today: string
): ExpenseCycleProgress {
  const spent = movements.reduce(
    (total, movement) => total + (movement.amount < 0 ? -movement.amount : 0),
    0
  );
  const income = movements.reduce(
    (total, movement) => total + (movement.amount > 0 ? movement.amount : 0),
    0
  );
  const ended = today > cycle.endDate;
  const daysLeft = ended
    ? 0
    : Math.max(
        0,
        Math.round((parseDay(cycle.endDate).getTime() - parseDay(today).getTime()) / MS_PER_DAY)
      );

  return {
    spent,
    income,
    remaining: cycle.initialBalance + income - spent,
    pct: cycle.expenseLimit > 0 ? Math.min(100, (spent / cycle.expenseLimit) * 100) : 0,
    over: spent > cycle.expenseLimit,
    ended,
    daysLeft,
  };
}

export interface CategorySpending {
  category: string;
  categoryEmoji?: string;
  spent: number;
}

/** Gastado por categoría, de mayor a menor — para "Categorías con más gasto" del detalle de un período. */
export function categoryBreakdown(movements: Movement[]): CategorySpending[] {
  const totals = new Map<string, CategorySpending>();
  for (const movement of movements) {
    if (movement.amount >= 0) continue;
    const current = totals.get(movement.category) ?? {
      category: movement.category,
      categoryEmoji: movement.categoryEmoji,
      spent: 0,
    };
    current.spent += -movement.amount;
    totals.set(movement.category, current);
  }
  return Array.from(totals.values()).sort((a, b) => b.spent - a.spent);
}

export interface DaySpending {
  date: string;
  spent: number;
}

/** Gastado por día, cronológico — para "Días con más consumo" del detalle de un período. */
export function dailyBreakdown(movements: Movement[]): DaySpending[] {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.amount >= 0) continue;
    totals.set(movement.date, (totals.get(movement.date) ?? 0) + -movement.amount);
  }
  return Array.from(totals.entries())
    .map(([date, spent]) => ({ date, spent }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
