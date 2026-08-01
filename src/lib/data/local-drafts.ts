"use client";

import { usePersistentState } from "lib-kit-components";
import type { Movement, Note } from "./home";
import { dayKeyOf } from "@/lib/home-model";

/**
 * Altas locales del FAB (`organisms/quick-actions`). Todavía no hay endpoint,
 * así que lo que se carga queda en el dispositivo — pero la pantalla de Inicio
 * las mezcla con los datos del server para que lo recién cargado se vea al
 * instante, marcado con `local: true`.
 *
 * `usePersistentState` es SSR-safe: en el server y en el primer render del
 * browser devuelve el valor inicial, así que mezclar estas listas con las del
 * server no rompe la hidratación.
 */

export const DRAFT_KEYS = {
  notes: "maguita:notas",
  expenses: "maguita:gastos",
} as const;

/** `id` es el `Date.now()` del alta: hace también de fecha. */
export interface NoteDraft {
  id: number;
  text: string;
}

export interface ExpenseDraft {
  id: number;
  /** Siempre positivo: el signo lo pone la conversión a `Movement`. */
  amount: number;
  concept: string;
}

// Constantes de módulo: pasarle un `[]` nuevo en cada render al hook lo haría
// re-inicializar el estado.
const NO_NOTES: NoteDraft[] = [];
const NO_EXPENSES: ExpenseDraft[] = [];

export function useNoteDrafts() {
  return usePersistentState<NoteDraft[]>(DRAFT_KEYS.notes, NO_NOTES);
}

export function useExpenseDrafts() {
  return usePersistentState<ExpenseDraft[]>(DRAFT_KEYS.expenses, NO_EXPENSES);
}

export function noteFromDraft(draft: NoteDraft): Note {
  return {
    id: `local-note-${draft.id}`,
    text: draft.text,
    date: dayKeyOf(draft.id),
    local: true,
  };
}

export function movementFromDraft(draft: ExpenseDraft): Movement {
  return {
    id: `local-expense-${draft.id}`,
    title: draft.concept,
    category: "Otros",
    amount: -Math.abs(draft.amount),
    date: dayKeyOf(draft.id),
    local: true,
  };
}
