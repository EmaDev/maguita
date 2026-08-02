"use client";

import { usePersistentState } from "lib-kit-components";
import type { Note } from "./home";
import { dayKeyOf } from "@/lib/home-model";

/**
 * Altas locales del FAB (`organisms/quick-actions`) que todavía no tienen
 * backend: lo que se carga queda en el dispositivo, pero la pantalla de
 * Inicio las mezcla con los datos del server para que lo recién cargado se
 * vea al instante, marcado con `local: true`. Los gastos ya tienen backend
 * propio (el gestor de gastos, ver `lib/data/expenses(-actions)`), así que
 * no viven acá.
 *
 * `usePersistentState` es SSR-safe: en el server y en el primer render del
 * browser devuelve el valor inicial, así que mezclar estas listas con las del
 * server no rompe la hidratación.
 */

export const DRAFT_KEYS = {
  notes: "maguita:notas",
} as const;

/** `id` es el `Date.now()` del alta: hace también de fecha. */
export interface NoteDraft {
  id: number;
  text: string;
}

// Constante de módulo: pasarle un `[]` nuevo en cada render al hook lo haría
// re-inicializar el estado.
const NO_NOTES: NoteDraft[] = [];

export function useNoteDrafts() {
  return usePersistentState<NoteDraft[]>(DRAFT_KEYS.notes, NO_NOTES);
}

export function noteFromDraft(draft: NoteDraft): Note {
  return {
    id: `local-note-${draft.id}`,
    text: draft.text,
    date: dayKeyOf(draft.id),
    local: true,
  };
}
