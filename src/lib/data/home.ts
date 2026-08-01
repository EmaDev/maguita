import "server-only";
import { dayKey } from "@/lib/home-model";

/**
 * Datos de la pantalla de Inicio: movimientos, notas y hábitos.
 *
 * Igual que el resto de `lib/data`, es la fuente única de la pantalla y hoy
 * devuelve las tres colecciones vacías: la app está sin datos a propósito
 * hasta que exista el backend. Acá va el fetch/query real, y los tipos ya son
 * los definitivos, así que enchufarlo no obliga a tocar los paneles.
 */

export interface Movement {
  id: string;
  title: string;
  category: string;
  /** Positivo = ingreso, negativo = gasto. Sin decimales: son pesos enteros. */
  amount: number;
  /** Día del movimiento en formato `yyyy-mm-dd` (sin hora: se registra por día). */
  date: string;
  /** Se cargó en este dispositivo y todavía no llegó al servidor. */
  local?: boolean;
}

export interface Note {
  id: string;
  text: string;
  /** Día en que se escribió, `yyyy-mm-dd`. */
  date: string;
  local?: boolean;
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
  movements: Movement[];
  notes: Note[];
  habits: Habit[];
}

/**
 * `_userId` todavía no filtra nada: no hay de dónde traer los datos, pero la
 * firma ya es la definitiva.
 */
export async function getHomeData(_userId: string): Promise<HomeData> {
  return {
    today: dayKey(new Date()),
    movements: [],
    notes: [],
    habits: [],
  };
}
