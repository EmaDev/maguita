"use client";

import { startTransition, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AnimatedCounter,
  AnimatedProgressRing,
  Button,
  Card,
  Checkbox,
  Confetti,
  PageStatusScreen,
  ProgressBar,
  StreakTracker,
  useHaptics,
  useSnackbar,
} from "lib-kit-components";
import { FlameIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { deleteHabitAction, toggleHabitDayAction } from "@/lib/data/habits-actions";
import type { Habit } from "@/lib/data/home";
import { habitsToday, longestStreakOf, streakOf, weekCountOf } from "@/lib/home-model";
import { HabitComposer } from "./HabitComposer";

/**
 * Tab "Hábitos": el check del día, la racha de cada hábito y la grilla de
 * constancia de las últimas semanas.
 *
 * El marcado va a Firestore (`toggleHabitDayAction`) pero se pinta optimista
 * con `useOptimistic`: marcar un hábito es la acción que el usuario repite
 * todos los días y esperar el round-trip haría que el check se sienta trabado.
 * Si la acción falla, el estado optimista se descarta solo al terminar la
 * transición y la fila vuelve sola a como estaba — por eso el `catch` sólo
 * avisa, no revierte nada a mano.
 */
interface HabitsPanelProps {
  today: string;
  habits: Habit[];
}

/** Chip de racha. Se remonta con cada cambio de `streak` para que el número entre animado. */
function StreakBadge({ streak }: { streak: number }) {
  return (
    <motion.span
      key={streak}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success"
    >
      <FlameIcon className="h-3.5 w-3.5" />
      {streak}
    </motion.span>
  );
}

export function HabitsPanel({ today, habits }: HabitsPanelProps) {
  const { snack } = useSnackbar();
  const { haptic } = useHaptics();
  const { openSheet, closeSheet } = useAppSheet();
  const [deleting, startDeleting] = useTransition();

  /**
   * Aplica el toggle sobre el hábito tocado sin esperar al server. Devuelve
   * una lista nueva (no muta) porque React compara por referencia para saber
   * qué re-renderizar.
   */
  const [optimisticHabits, applyToggle] = useOptimistic(
    habits,
    (current: Habit[], change: { habitId: string; done: boolean }) =>
      current.map((habit) =>
        habit.id !== change.habitId
          ? habit
          : {
              ...habit,
              doneDates: change.done
                ? [...habit.doneDates, today]
                : habit.doneDates.filter((day) => day !== today),
            }
      )
  );

  const status = habitsToday(optimisticHabits, today);
  const allDone = status.total > 0 && status.done === status.total;

  /**
   * Confeti sólo en el momento en que el día se completa, no mientras siga
   * completo: sin comparar contra el valor anterior volvería a dispararse en
   * cada render (al cambiar de tab, al revalidar) y festejaría de nuevo algo
   * que el usuario ya festejó. Arranca en 0 porque `Confetti` no dispara con
   * `fire <= 0` — así tampoco festeja al entrar a la tab con todo ya hecho.
   */
  const [celebration, setCelebration] = useState(0);
  const wasAllDone = useRef(allDone);

  useEffect(() => {
    if (allDone && !wasAllDone.current) setCelebration((shot) => shot + 1);
    wasAllDone.current = allDone;
  }, [allDone]);

  function openComposer(habit?: Habit) {
    openSheet(<HabitComposer habit={habit} onSaved={closeSheet} />, {
      title: habit ? "Editar hábito" : "Nuevo hábito",
    });
  }

  function toggle(habit: Habit, done: boolean) {
    haptic(done ? "success" : "tap");
    startTransition(async () => {
      applyToggle({ habitId: habit.id, done });
      try {
        await toggleHabitDayAction(habit.id, today, done);
      } catch (error) {
        snack({
          message:
            error instanceof Error ? error.message : "No se pudo guardar el hábito.",
          variant: "error",
        });
      }
    });
  }

  function remove(habit: Habit) {
    startDeleting(async () => {
      try {
        await deleteHabitAction(habit.id);
        snack({ message: "Hábito eliminado.", variant: "success" });
      } catch (error) {
        snack({
          message:
            error instanceof Error ? error.message : "No se pudo eliminar el hábito.",
          variant: "error",
        });
      }
    });
  }

  // Sin hábitos no hay nada que medir: el progreso del día y la grilla de
  // constancia quedarían en cero, que se lee como un error y no como un vacío.
  if (habits.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no hay hábitos"
        description="Cuando sumes uno, acá vas a ver el check del día, la racha y tu constancia."
        primary={{ label: "Crear hábito", onClick: () => openComposer() }}
      />
    );
  }

  // Un día cuenta para la grilla de constancia si se cumplió al menos un
  // hábito: mide que hubo actividad, no que el día fue perfecto.
  const activeDays = Array.from(new Set(optimisticHabits.flatMap((habit) => habit.doneDates)));

  return (
    <div className="space-y-4">
      {/* `relative` + `overflow-hidden`: el canvas del confeti se posiciona
          absolute sobre este contenedor y no debe desbordar la card. */}
      <Card variant="glass" padding="md" className="relative overflow-hidden">
        <Confetti fire={celebration} mode="center" count={120} />

        <div className="flex items-center gap-4">
          <AnimatedProgressRing
            value={(status.done / status.total) * 100}
            size={76}
            strokeWidth={7}
            label={`${status.done}/${status.total}`}
            color={allDone ? "var(--color-success)" : undefined}
          />

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Hoy
            </p>
            <p className="mt-0.5 text-lg font-semibold">
              {allDone ? "¡Día completo!" : `Te faltan ${status.total - status.done}`}
            </p>

            {status.bestStreak > 0 && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-success">
                <FlameIcon className="h-4 w-4" />
                <span className="font-semibold">
                  <AnimatedCounter value={status.bestStreak} />
                </span>
                {status.bestStreak === 1 ? "día de racha" : "días de racha"}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Tus hábitos
        </p>
        <Button size="sm" variant="ghost" onClick={() => openComposer()}>
          <PlusIcon className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* `popLayout` deja que las filas restantes suban a su lugar mientras la
          borrada todavía está animando su salida. */}
      <ul className="space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {optimisticHabits.map((habit) => {
            const done = habit.doneDates.includes(today);
            const streak = streakOf(habit.doneDates, today);
            const record = longestStreakOf(habit.doneDates);
            const week = weekCountOf(habit.doneDates, today);

            return (
              <motion.li
                key={habit.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <Card variant="glass" padding="sm">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Checkbox
                        checked={done}
                        onChange={(next: boolean) => toggle(habit, next)}
                        tone="success"
                        label={
                          <span className={done ? "text-muted line-through" : ""}>
                            <span className="mr-1.5">{habit.emoji}</span>
                            {habit.name}
                          </span>
                        }
                        description={
                          <span className="text-xs">
                            {week}/{habit.goalPerWeek} esta semana
                            {record > 0 && ` · Récord: ${record}`}
                          </span>
                        }
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <AnimatePresence mode="popLayout">
                        {streak > 0 && <StreakBadge streak={streak} />}
                      </AnimatePresence>

                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${habit.name}`}
                        onClick={() => openComposer(habit)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${habit.name}`}
                        disabled={deleting}
                        onClick={() => remove(habit)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ProgressBar
                    className="mt-2.5"
                    value={Math.min(week, habit.goalPerWeek)}
                    max={habit.goalPerWeek}
                    tone={week >= habit.goalPerWeek ? "success" : "primary"}
                    size="sm"
                  />
                </Card>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <Card variant="glass" padding="md">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Constancia
        </p>
        {/* 12 semanas: en mobile la grilla entra completa sin scroll horizontal. */}
        <StreakTracker
          className="mt-3"
          studiedDates={activeDays}
          weeks={12}
          goalPerWeek={habits.length}
        />
      </Card>
    </div>
  );
}
