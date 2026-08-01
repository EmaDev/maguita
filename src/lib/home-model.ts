import type { Habit, Movement } from "@/lib/data/home";

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

export interface MonthBalance {
  income: number;
  /** Total gastado, en positivo. */
  expense: number;
  balance: number;
  count: number;
}

/** Ingresos, gastos y balance del mes calendario al que pertenece `today`. */
export function monthBalance(movements: Movement[], today: string): MonthBalance {
  const month = today.slice(0, 7);
  return movements
    .filter((movement) => movement.date.startsWith(month))
    .reduce<MonthBalance>(
      (acc, movement) => ({
        income: acc.income + (movement.amount > 0 ? movement.amount : 0),
        expense: acc.expense + (movement.amount < 0 ? -movement.amount : 0),
        balance: acc.balance + movement.amount,
        count: acc.count + 1,
      }),
      { income: 0, expense: 0, balance: 0, count: 0 }
    );
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
