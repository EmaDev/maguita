"use client";

import { useCallback, useMemo } from "react";
import { usePersistentState } from "lib-kit-components";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellTabs } from "@/components/shell/shell-tabs";
import { NewExpenseSheet, NewNoteSheet } from "@/components/organisms/quick-actions";
import { HabitsPanel } from "./home/HabitsPanel";
import { MovementsPanel } from "./home/MovementsPanel";
import { NotesPanel } from "./home/NotesPanel";
import { SummaryPanel } from "./home/SummaryPanel";
import { isHomeTab, type HomeTab } from "./home/tabs";
import type { Habit, HomeData } from "@/lib/data/home";
import {
  movementFromDraft,
  noteFromDraft,
  useExpenseDrafts,
  useNoteDrafts,
} from "@/lib/data/local-drafts";
import { byDayDesc } from "@/lib/home-model";

/**
 * Contenido de Inicio. Las tabs no las monta la pantalla: viven en la fila
 * extra del `AppHeader` del shell (su slot `children`), declaradas en
 * `nav-config`. Acá leemos cuál está activa y mostramos su panel.
 *
 * Los datos se resuelven una sola vez a este nivel y bajan a los cuatro
 * paneles: el resumen es el índice de las otras tres tabs, así que si cada
 * panel hiciera su propia mezcla terminarían mostrando números distintos.
 */

/** Días marcados en este dispositivo, por hábito. Constante: ver `local-drafts`. */
const NO_HABIT_LOG: Record<string, string[]> = {};

export function HomeBoard({ data }: { data: HomeData }) {
  const { today } = data;
  const { tab, setTab } = useShellTabs();
  const active: HomeTab = isHomeTab(tab) ? tab : "resumen";
  const { openSheet } = useAppSheet();

  // Altas del FAB: todavía no hay endpoint, pero la pantalla las mezcla con los
  // datos del server para que lo recién cargado no desaparezca. El hook es
  // SSR-safe (devuelve la lista vacía hasta hidratar), así que la mezcla no
  // rompe el primer render.
  const [noteDrafts] = useNoteDrafts();
  const [expenseDrafts] = useExpenseDrafts();
  const [habitLog, setHabitLog] = usePersistentState<Record<string, string[]>>(
    "maguita:habitos",
    NO_HABIT_LOG
  );

  // Lo local primero: a igual día, el sort estable deja arriba lo que se acaba
  // de cargar.
  const movements = useMemo(
    () => byDayDesc([...expenseDrafts.map(movementFromDraft), ...data.movements]),
    [expenseDrafts, data.movements]
  );

  const notes = useMemo(
    () => byDayDesc([...noteDrafts.map(noteFromDraft), ...data.notes]),
    [noteDrafts, data.notes]
  );

  const habits = useMemo<Habit[]>(
    () =>
      data.habits.map((habit) => ({
        ...habit,
        doneDates: Array.from(
          new Set([...habit.doneDates, ...(habitLog[habit.id] ?? [])])
        ),
      })),
    [data.habits, habitLog]
  );

  const toggleHabit = useCallback(
    (habitId: string, done: boolean) => {
      setHabitLog((prev) => {
        const marked = prev[habitId] ?? [];
        return {
          ...prev,
          [habitId]: done
            ? marked.includes(today)
              ? marked
              : [...marked, today]
            : marked.filter((day) => day !== today),
        };
      });
    },
    [setHabitLog, today]
  );

  // Reusamos los mismos sheets del FAB: son la única alta que hay, y montarlos
  // en el sheet global del shell evita duplicar el formulario.
  const openNewNote = useCallback(
    () =>
      openSheet(<NewNoteSheet />, {
        title: "Nueva nota",
        description: "Anotá algo rápido antes de que se te olvide.",
      }),
    [openSheet]
  );

  const openNewExpense = useCallback(
    () => openSheet(<NewExpenseSheet />, { title: "Nuevo gasto" }),
    [openSheet]
  );

  switch (active) {
    case "movimientos":
      return (
        <MovementsPanel today={today} movements={movements} onAdd={openNewExpense} />
      );
    case "notas":
      return <NotesPanel today={today} notes={notes} onAdd={openNewNote} />;
    case "habitos":
      return <HabitsPanel today={today} habits={habits} onToggle={toggleHabit} />;
    default:
      return (
        <SummaryPanel
          today={today}
          movements={movements}
          notes={notes}
          habits={habits}
          onGoTo={setTab}
        />
      );
  }
}
