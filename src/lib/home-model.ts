import type { Habit, Movement, Note, NotePriority } from "@/lib/data/home";
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

/**
 * Instante absoluto (ms desde epoch) de una alerta `yyyy-mm-dd` + `HH:mm`.
 *
 * **Se calcula en el cliente, a propósito.** `alertDate`/`alertTime` son la
 * hora local de quien carga la nota, y el único que conoce ese huso —con su
 * horario de verano incluido, que cambia según la fecha— es el navegador del
 * usuario. El server no puede derivarlo: interpretar esos strings con su
 * propio reloj haría sonar la alerta corrida tantas horas como diferencia haya
 * (en un deploy en UTC, tres horas antes para Argentina).
 */
export function alertInstant(day: string, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  // `parseDay` da el mediodía local para esquivar el salto de DST a las 00:00;
  // acá se le pisa la hora, así que ese resguardo ya no aplica y el resultado
  // es el instante exacto que el usuario eligió.
  const date = parseDay(day);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.getTime();
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

/**
 * La racha más larga que el hábito tuvo alguna vez, esté activa o no. Es el
 * récord contra el que se compara la racha actual ("vas 4, tu récord es 12").
 *
 * Ordena las fechas como strings: el formato `yyyy-mm-dd` es lexicográfico,
 * así que ordenarlo alfabéticamente ya es ordenarlo cronológicamente, sin
 * construir un `Date` por día.
 */
export function longestStreakOf(doneDates: string[]): number {
  const days = Array.from(new Set(doneDates)).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of days) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }

  return best;
}

/**
 * Días cumplidos en los últimos 7 días corridos, hoy incluido — se compara
 * contra `goalPerWeek`. Son 7 días hacia atrás, no la semana calendario: así
 * la meta no se "resetea" el lunes ni queda a mitad de camino un miércoles.
 */
export function weekCountOf(doneDates: string[], today: string): number {
  const done = new Set(doneDates);
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    if (done.has(shiftDay(today, -offset))) count += 1;
  }
  return count;
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

const PRIORITY_WEIGHT: Record<NotePriority, number> = { high: 3, medium: 2, low: 1 };

export type NoteSortField = "date" | "priority";
export type NoteSortDirection = "asc" | "desc";

/** Orden "natural" de cada campo: prioridad más alta primero, fecha más reciente primero. */
function compareNotesDesc(a: Note, b: Note, field: NoteSortField): number {
  if (field === "priority") {
    const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (diff !== 0) return diff;
  }
  // También desempata el orden por prioridad: a igual prioridad, la más reciente arriba.
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

/**
 * Ordena notas por fecha o prioridad, en cualquiera de las dos direcciones —
 * la barra de filtros de la tab Notas expone un toggle asc/desc, así que ya no
 * alcanza con un único orden fijo por campo. `asc` invierte el comparador
 * entero, desempate incluido (a igual prioridad, la más vieja arriba).
 */
export function sortNotes(
  notes: Note[],
  field: NoteSortField,
  direction: NoteSortDirection
): Note[] {
  const flip = direction === "asc" ? -1 : 1;
  return [...notes].sort((a, b) => flip * compareNotesDesc(a, b, field));
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
