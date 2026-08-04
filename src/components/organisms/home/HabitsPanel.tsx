"use client";

import { startTransition, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
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
import {
  CheckIcon,
  ChevronDownIcon,
  FlameIcon,
  GripIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  SparkleIcon,
  TrashIcon,
} from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import {
  deleteHabitAction,
  reorderHabitsAction,
  toggleHabitActionAction,
  toggleHabitDayAction,
} from "@/lib/data/habits-actions";
import type { Habit, HabitAction } from "@/lib/data/home";
import {
  actionsDoneCountOn,
  allActionsDoneOn,
  habitsToday,
  isScheduledOn,
  longestStreakOf,
  scheduledWeekCountOf,
  streakOf,
} from "@/lib/home-model";
import { HabitComposer } from "./HabitComposer";
import { WEEKDAY_CHIPS } from "./habit-options";

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
  pinSet: boolean;
  locked: boolean;
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

/** Badge de puntaje. Tono `danger` cuando el hábito está en negativo (más penalizaciones que días cumplidos). */
function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        score < 0 ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent"
      }`}
    >
      <SparkleIcon className="h-3.5 w-3.5" />
      {score}
    </span>
  );
}

/** Pastillas L M M J V S D: resalta los días programados del hábito. */
function SchedulePills({ scheduledWeekdays }: { scheduledWeekdays: number[] }) {
  return (
    <div className="mt-1.5 flex gap-1">
      {WEEKDAY_CHIPS.map((chip) => {
        const active = scheduledWeekdays.includes(Number(chip.id));
        return (
          <span
            key={chip.id}
            className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-semibold ${
              active ? "bg-primary/15 text-primary" : "text-muted/50"
            }`}
          >
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Timeline vertical de los pasos de un hábito de grupo: punto + línea
 * conectora por paso, clickeable. `ActivityTimeline` de `lib-kit-components`
 * tiene el mismo lenguaje visual pero es de sólo lectura (sin `onClick` por
 * ítem), así que no sirve acá — se arma a mano con el mismo criterio.
 */
function ActionTimeline({
  actions,
  today,
  disabled,
  onToggle,
}: {
  actions: HabitAction[];
  today: string;
  disabled: boolean;
  onToggle: (actionId: string, done: boolean) => void;
}) {
  return (
    <ol className="mt-3">
      {actions.map((action, index) => {
        const done = action.doneDates.includes(today);
        const isLast = index === actions.length - 1;
        return (
          <li key={action.id} className="relative flex gap-3 pb-3 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-5 h-full w-px ${
                  done ? "bg-success/40" : "bg-border"
                }`}
              />
            )}
            <button
              type="button"
              disabled={disabled}
              aria-pressed={done}
              aria-label={`${done ? "Desmarcar" : "Marcar"} ${action.name}`}
              onClick={() => onToggle(action.id, !done)}
              className={`relative z-10 mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                done ? "border-success bg-success text-white" : "border-border bg-surface"
              }`}
            >
              {done && <CheckIcon className="h-3 w-3" />}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(action.id, !done)}
              className={`flex-1 text-left text-sm disabled:opacity-50 ${
                done ? "text-muted line-through" : ""
              }`}
            >
              {action.name}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface HabitRowProps {
  habit: Habit;
  today: string;
  deleting: boolean;
  onToggle: (habit: Habit, done: boolean) => void;
  onToggleAction: (habit: Habit, actionId: string, done: boolean) => void;
  onEdit: (habit: Habit) => void;
  onRemove: (habit: Habit) => void;
}

/**
 * Una fila de la lista. Componente propio (no un `.map` inline) porque
 * necesita su propio `useDragControls`: el handle de arrastre (`GripIcon`)
 * es lo único que dispara el drag (`dragListener={false}` en `Reorder.Item`),
 * así que tocar el `Checkbox`/timeline o los botones de al lado no reordena
 * nada. También guarda acá el estado de expandido/colapsado del timeline
 * (sólo aplica a un hábito de grupo), colapsado por default.
 */
function HabitRow({ habit, today, deleting, onToggle, onToggleAction, onEdit, onRemove }: HabitRowProps) {
  const dragControls = useDragControls();
  const [expanded, setExpanded] = useState(false);

  const isGroup = habit.actions.length > 0;
  const done = habit.doneDates.includes(today);
  const streak = streakOf(habit.doneDates, today);
  const record = longestStreakOf(habit.doneDates);
  const week = scheduledWeekCountOf(habit.doneDates, habit.scheduledWeekdays, today);
  const goal = habit.scheduledWeekdays.length;
  const scheduledToday = isScheduledOn(habit.scheduledWeekdays, today);
  const doneToday = actionsDoneCountOn(habit.actions, today);

  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <Card variant="glass" padding="sm">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-1 shrink-0 cursor-grab touch-none text-muted active:cursor-grabbing"
            aria-label={`Reordenar ${habit.name}`}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripIcon className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            {isGroup ? (
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => setExpanded((prev) => !prev)}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${done ? "text-muted line-through" : ""}`}>
                    <span className="mr-1.5">{habit.emoji}</span>
                    {habit.name}
                  </span>
                  <span className="text-xs">
                    {habit.subtitle && <span className="block text-muted">{habit.subtitle}</span>}
                    {scheduledToday ? `${doneToday}/${habit.actions.length} hoy` : "Hoy no toca"}
                    {record > 0 && ` · Récord: ${record}`}
                  </span>
                </span>
                <ChevronDownIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : (
              <Checkbox
                checked={done}
                disabled={!scheduledToday}
                onChange={(next: boolean) => onToggle(habit, next)}
                tone="success"
                label={
                  <span className={done ? "text-muted line-through" : ""}>
                    <span className="mr-1.5">{habit.emoji}</span>
                    {habit.name}
                  </span>
                }
                description={
                  <span className="text-xs">
                    {habit.subtitle && <span className="block text-muted">{habit.subtitle}</span>}
                    {scheduledToday
                      ? `${week}/${goal} esta semana`
                      : "Hoy no toca"}
                    {record > 0 && ` · Récord: ${record}`}
                  </span>
                }
              />
            )}
            <SchedulePills scheduledWeekdays={habit.scheduledWeekdays} />

            {isGroup && (
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ActionTimeline
                      actions={habit.actions}
                      today={today}
                      disabled={!scheduledToday}
                      onToggle={(actionId, next) => onToggleAction(habit, actionId, next)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <ScoreBadge score={habit.score} />
            <AnimatePresence mode="popLayout">
              {streak > 0 && <StreakBadge streak={streak} />}
            </AnimatePresence>

            <Button
              size="icon"
              variant="ghost"
              aria-label={`Editar ${habit.name}`}
              onClick={() => onEdit(habit)}
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Eliminar ${habit.name}`}
              disabled={deleting}
              onClick={() => onRemove(habit)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ProgressBar
          className="mt-2.5"
          value={Math.min(week, goal)}
          max={goal}
          tone={week >= goal ? "success" : "primary"}
          size="sm"
        />
      </Card>
    </Reorder.Item>
  );
}

export function HabitsPanel({ today, habits, pinSet, locked }: HabitsPanelProps) {
  const { snack } = useSnackbar();
  const { haptic } = useHaptics();
  const { openSheet, closeSheet } = useAppSheet();
  const [deleting, startDeleting] = useTransition();

  function openSettingsSheet() {
    openSheet(<PinLockSwitch moduleId="habitos" locked={locked} pinConfigured={pinSet} />, {
      title: "Ajustes",
      description: "Privacidad de la tab Hábitos.",
    });
  }

  /**
   * Aplica el toggle sobre el hábito tocado sin esperar al server. Devuelve
   * una lista nueva (no muta) porque React compara por referencia para saber
   * qué re-renderizar.
   *
   * Con `actionId` (hábito de grupo) actualiza el `doneDates` de ese paso y
   * recalcula el `doneDates` del hábito con `allActionsDoneOn` — la misma
   * cuenta que hace `toggleHabitActionAction` del lado del server — para que
   * el badge "X/N", el check tachado y el anillo de arriba reaccionen al
   * toque sin esperar el round-trip.
   */
  const [optimisticHabits, applyToggle] = useOptimistic(
    habits,
    (current: Habit[], change: { habitId: string; actionId?: string; done: boolean }) =>
      current.map((habit) => {
        if (habit.id !== change.habitId) return habit;

        if (change.actionId) {
          const actions = habit.actions.map((action) =>
            action.id !== change.actionId
              ? action
              : {
                  ...action,
                  doneDates: change.done
                    ? [...action.doneDates, today]
                    : action.doneDates.filter((day) => day !== today),
                }
          );
          return {
            ...habit,
            actions,
            doneDates: allActionsDoneOn(actions, today)
              ? Array.from(new Set([...habit.doneDates, today]))
              : habit.doneDates.filter((day) => day !== today),
          };
        }

        return {
          ...habit,
          doneDates: change.done
            ? [...habit.doneDates, today]
            : habit.doneDates.filter((day) => day !== today),
        };
      })
  );

  /**
   * Orden de la lista, aparte del contenido: `Reorder.Group` necesita un
   * array de `values` que pueda reescribir en cada drag, y mezclar eso con el
   * reducer de `useOptimistic` de arriba complicaría los dos a la vez. Se
   * guarda como ids y se resuelve contra `optimisticHabits` en cada render,
   * así el contenido (streak, done, score) siempre sale de la fuente única.
   *
   * Se resincroniza con `habits` ajustando el estado durante el render (no en
   * un `useEffect`) cuando cambia la referencia del prop — es el patrón que
   * recomienda React para "derivar estado de un prop que cambió" sin el
   * re-render extra de un efecto.
   */
  const [syncedHabits, setSyncedHabits] = useState(habits);
  const [orderIds, setOrderIds] = useState(() => habits.map((habit) => habit.id));
  if (habits !== syncedHabits) {
    setSyncedHabits(habits);
    setOrderIds(habits.map((habit) => habit.id));
  }

  const habitById = new Map(optimisticHabits.map((habit) => [habit.id, habit]));
  const orderedHabits = orderIds
    .map((id) => habitById.get(id))
    .filter((habit): habit is Habit => habit != null);

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

  function toggleAction(habit: Habit, actionId: string, done: boolean) {
    haptic(done ? "success" : "tap");
    startTransition(async () => {
      applyToggle({ habitId: habit.id, actionId, done });
      try {
        await toggleHabitActionAction(habit.id, actionId, today, done);
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el paso.",
          variant: "error",
        });
      }
    });
  }

  function reorder(newOrder: Habit[]) {
    setOrderIds(newOrder.map((habit) => habit.id));
    startTransition(async () => {
      try {
        await reorderHabitsAction(newOrder.map((habit) => habit.id));
      } catch (error) {
        snack({
          message:
            error instanceof Error ? error.message : "No se pudo guardar el orden.",
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
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
            <SettingsIcon />
          </Button>
        </div>
        <PageStatusScreen
          status="empty"
          title="Todavía no hay hábitos"
          description="Cuando sumes uno, acá vas a ver el check del día, la racha y tu constancia."
          primary={{ label: "Crear hábito", onClick: () => openComposer() }}
        />
      </div>
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
            value={status.total > 0 ? (status.done / status.total) * 100 : 0}
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
              {status.total === 0
                ? "Nada programado hoy"
                : allDone
                  ? "¡Día completo!"
                  : `Te faltan ${status.total - status.done}`}
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
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
            <SettingsIcon />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openComposer()}>
            <PlusIcon className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      <Reorder.Group
        as="ul"
        axis="y"
        values={orderedHabits}
        onReorder={reorder}
        className="space-y-2.5"
      >
        <AnimatePresence initial={false}>
          {orderedHabits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              deleting={deleting}
              onToggle={toggle}
              onToggleAction={toggleAction}
              onEdit={openComposer}
              onRemove={remove}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

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
