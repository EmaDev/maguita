import "server-only";
import { dayKey } from "@/lib/home-model";
import { getActiveExpenseCycle, getExpenseMovements, type ExpenseCycle } from "./expenses";
import { getExpenseCategories, type ExpenseCategoryItem } from "./expense-categories";
import { getNotes } from "./notes";

/**
 * Datos de la pantalla de Inicio: movimientos, notas y hábitos.
 *
 * Igual que el resto de `lib/data`, es la fuente única de la pantalla. Hábitos
 * todavía devuelve la colección vacía (sin backend); movimientos y notas ya
 * salen de Firestore.
 */

export interface Movement {
  id: string;
  title: string;
  category: string;
  /** Emoji de la categoría al momento de cargar el gasto. Ausente en movimientos que no vienen del gestor de gastos. */
  categoryEmoji?: string;
  /** Positivo = ingreso, negativo = gasto. Sin decimales: son pesos enteros. */
  amount: number;
  /** Día del movimiento en formato `yyyy-mm-dd` (sin hora: se registra por día). */
  date: string;
  /** Se cargó en este dispositivo y todavía no llegó al servidor. */
  local?: boolean;
}

export type NotePriority = "low" | "medium" | "high";

export interface Note {
  id: string;
  text: string;
  /** Día al que corresponde la nota, `yyyy-mm-dd` (no necesariamente el de creación). */
  date: string;
  priority: NotePriority;
  /** Si además de nota es un recordatorio con fecha/hora propias. */
  hasAlert: boolean;
  /** `yyyy-mm-dd`. `null` si `hasAlert` es `false`. */
  alertDate: string | null;
  /** `HH:mm`. `null` si `hasAlert` es `false`. */
  alertTime: string | null;
}

export interface Habit {
  id: string;
  name: string;
  /** Días cumplidos, en formato `yyyy-mm-dd`. */
  doneDates: string[];
  /** Meta de días por semana. Informativa: no afecta ningún cálculo. */
  goalPerWeek: number;
}

export interface HomeData {
  /**
   * Día de referencia (`yyyy-mm-dd`) resuelto en el server y bajado como prop.
   * Que el cliente no lo recalcule es lo que evita que el HTML del server y el
   * primer render del browser difieran cuando están en husos distintos.
   */
  today: string;
  /** Movimientos del ciclo activo del gestor de gastos (`[]` si no hay ninguno). */
  movements: Movement[];
  notes: Note[];
  habits: Habit[];
  /** Ciclo `active` del gestor de gastos, o `null` si el usuario todavía no armó ninguno. */
  expenseCycle: ExpenseCycle | null;
  /** ABM de categorías del usuario (o el set por default si todavía no tocó el ABM). */
  expenseCategories: ExpenseCategoryItem[];
}

/**
 * Hábitos todavía no tienen backend (`_userId` no filtra nada ahí). El
 * gestor de gastos y las notas sí: los movimientos son los del ciclo activo
 * del usuario (si tiene uno), y las notas son todas las suyas.
 */
export async function getHomeData(userId: string): Promise<HomeData> {
  const [expenseCycle, expenseCategories, notes] = await Promise.all([
    getActiveExpenseCycle(userId),
    getExpenseCategories(userId),
    getNotes(userId),
  ]);
  const movements = expenseCycle ? await getExpenseMovements(expenseCycle.id) : [];

  return {
    today: dayKey(new Date()),
    movements,
    notes,
    habits: [],
    expenseCycle,
    expenseCategories,
  };
}
