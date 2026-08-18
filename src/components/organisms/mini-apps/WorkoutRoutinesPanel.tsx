"use client";

import { useMemo, useState } from "react";
import {
  AnimatedCounter,
  Button,
  Card,
  Confetti,
  PageStatusScreen,
  ProgressBar,
  StreakTracker,
  useHaptics,
} from "lib-kit-components";
import {
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  FlameIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/atoms/icons";
import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellSearch } from "@/components/shell/shell-search";
import type { WorkoutRoutine, WorkoutSession } from "@/lib/data/workouts";
import type { ExerciseInfo } from "@/lib/exercise-catalog";
import { formatDay } from "@/lib/home-model";
import {
  longestWorkoutStreak,
  routineDayFor,
  routineWeekdays,
  workoutStreak,
  workoutTypeMeta,
  workoutWeekProgress,
} from "@/lib/workout-model";
import { WorkoutImportSheet } from "./WorkoutImportSheet";
import { WorkoutRoutineCard } from "./WorkoutRoutineCard";
import { WorkoutRoutineComposer } from "./WorkoutRoutineComposer";
import { WorkoutSessionComposer } from "./WorkoutSessionComposer";

/** Cuántos días entrenados muestra el historial antes de "Ver todo". */
const HISTORY_PAGE = 8;

/** Id del módulo para PinLock — el mismo `MiniApp.id` del catálogo. */
const MODULE_ID = "entrenamiento";

interface WorkoutRoutinesPanelProps {
  /** Día de referencia (`yyyy-mm-dd`) resuelto en el server: que el cliente no lo recalcule evita un mismatch de hidratación entre husos. */
  today: string;
  routines: WorkoutRoutine[];
  sessions: WorkoutSession[];
  /** Ejercicios propios, para el picker de la biblioteca dentro del composer. */
  customExercises: ExerciseInfo[];
  pinSet: boolean;
  locked: boolean;
}

/**
 * Tab "Rutinas": las rutinas del usuario (creadas a mano o importadas desde
 * JSON), qué toca hoy según la rutina activa, el registro del día con su
 * nota, y la racha de cumplimiento.
 *
 * La racha no cuenta días corridos sino **días de entrenamiento**: los de
 * descanso se saltean sin cortarla (ver `workoutStreak`). Todo se deriva de
 * `sessions` en cada render, igual que la racha de los hábitos — no hay
 * contador guardado que mantener sincronizado.
 */
export function WorkoutRoutinesPanel({
  today,
  routines,
  sessions,
  customExercises,
  pinSet,
  locked,
}: WorkoutRoutinesPanelProps) {
  const { haptic } = useHaptics();
  const { openSheet, closeSheet } = useAppSheet();
  const { query, setQuery } = useShellSearch();
  const [celebration, setCelebration] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);

  /**
   * El buscador del header filtra la lista de rutinas por nombre, tipo, día
   * o ejercicio: buscar "sentadilla" tiene que traer la rutina que la
   * incluye, aunque la palabra no esté en su nombre. No toca la card de
   * "Hoy" ni el historial — esos no son la lista que el buscador filtra.
   */
  const visibleRoutines = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return routines;
    return routines.filter((routine) =>
      [
        routine.name,
        routine.description ?? "",
        workoutTypeMeta(routine.type).label,
        ...routine.days.flatMap((day) => [day.title, ...day.exercises.map((e) => e.name)]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [routines, query]);

  const activeRoutine = routines.find((routine) => routine.active) ?? null;
  const doneDates = useMemo(() => sessions.map((session) => session.date), [sessions]);
  const sessionByDate = useMemo(
    () => new Map(sessions.map((session) => [session.date, session])),
    [sessions]
  );

  const scheduled = activeRoutine ? routineWeekdays(activeRoutine) : [];
  const streak = workoutStreak(doneDates, scheduled, today);
  const record = longestWorkoutStreak(doneDates, scheduled);
  const week = workoutWeekProgress(doneDates, scheduled, today);

  const todaySession = sessionByDate.get(today);
  const todayPlan = routineDayFor(activeRoutine, today);
  const restDay = Boolean(activeRoutine) && !todayPlan;

  function openSettingsSheet() {
    openSheet(<PinLockSwitch moduleId={MODULE_ID} locked={locked} pinConfigured={pinSet} />, {
      title: "Ajustes",
      description: "Privacidad de Entrenamiento.",
    });
  }

  function openSessionSheet(date: string, pickDate = false) {
    const session = sessionByDate.get(date);
    openSheet(
      <WorkoutSessionComposer
        date={date}
        today={today}
        session={session}
        activeRoutine={activeRoutine}
        pickDate={pickDate}
        sessionByDate={sessionByDate}
        onSaved={closeSheet}
        onLogged={() => {
          haptic("success");
          setCelebration((shot) => shot + 1);
        }}
      />,
      {
        title: pickDate
          ? "Registrar otro día"
          : session
            ? "Editar entrenamiento"
            : "Registrar entrenamiento",
      }
    );
  }

  /** Sólo el alta: editar una rutina existente se hace desde su detalle. */
  function openNewRoutineSheet() {
    openSheet(
      <WorkoutRoutineComposer customExercises={customExercises} onSaved={closeSheet} />,
      { title: "Nueva rutina" }
    );
  }

  function openImportSheet() {
    openSheet(<WorkoutImportSheet onImported={closeSheet} />, {
      title: "Importar rutina",
      description: "Desde un JSON.",
    });
  }

  const visibleSessions = showAllHistory ? sessions : sessions.slice(0, HISTORY_PAGE);

  return (
    <div className="space-y-4">
      {/* `relative` + `overflow-hidden`: el canvas del confeti se posiciona
          absolute sobre esta card y no debe desbordarla. */}
      <Card variant="glass" padding="md" className="relative overflow-hidden">
        <Confetti fire={celebration} mode="center" count={120} />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Hoy</p>
            <p className="mt-0.5 text-lg font-semibold">
              {todaySession
                ? todaySession.title
                : todayPlan
                  ? todayPlan.title
                  : restDay
                    ? "Día de descanso"
                    : "Sin rutina activa"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {activeRoutine
                ? `${workoutTypeMeta(activeRoutine.type).emoji} ${activeRoutine.name}`
                : "Creá o importá una rutina para ver qué te toca."}
            </p>
          </div>

          {todaySession && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
              <CheckIcon className="h-3.5 w-3.5" />
              Hecho
            </span>
          )}
        </div>

        {streak > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
            <FlameIcon className="h-4 w-4" />
            <span className="font-semibold">
              <AnimatedCounter value={streak} />
            </span>
            {streak === 1 ? "entrenamiento de racha" : "entrenamientos de racha"}
            {record > streak && <span className="text-muted"> · Récord: {record}</span>}
          </p>
        )}

        {week.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Esta semana</span>
              <span>
                {week.done}/{week.total}
              </span>
            </div>
            <ProgressBar
              className="mt-1"
              value={Math.min(week.done, week.total)}
              max={week.total}
              tone={week.done >= week.total ? "success" : "primary"}
              size="sm"
            />
          </div>
        )}

        <Button
          fullWidth
          className="mt-4"
          variant={todaySession ? "outline" : "primary"}
          onClick={() => openSessionSheet(today)}
        >
          {todaySession ? (
            <>
              <PencilIcon className="h-4 w-4" />
              Editar el registro de hoy
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4" />
              Registrar entrenamiento
            </>
          )}
        </Button>

        {/* Cargar un día atrasado tiene que ser posible: si no, un día que se
            entrenó pero se olvidó marcar corta la racha para siempre. */}
        <Button
          fullWidth
          size="sm"
          variant="ghost"
          className="mt-1"
          onClick={() => openSessionSheet(today, true)}
        >
          <CalendarIcon className="h-4 w-4" />
          Registrar otro día
        </Button>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Tus rutinas
        </p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
            <SettingsIcon />
          </Button>
          <Button size="sm" variant="ghost" onClick={openImportSheet}>
            <DownloadIcon className="h-4 w-4" />
            Importar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openNewRoutineSheet()}>
            <PlusIcon className="h-4 w-4" />
            Nueva
          </Button>
        </div>
      </div>

      {routines.length === 0 ? (
        <PageStatusScreen
          status="empty"
          title="Todavía no tenés rutinas"
          description="Armá una con tus días y ejercicios, o importá un JSON que ya tengas."
          primary={{ label: "Crear rutina", onClick: () => openNewRoutineSheet() }}
          secondary={{ label: "Importar JSON", onClick: openImportSheet }}
        />
      ) : visibleRoutines.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted">Ninguna rutina coincide con “{query}”.</p>
          <Button variant="ghost" className="mt-2" onClick={() => setQuery("")}>
            Limpiar búsqueda
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visibleRoutines.map((routine) => (
            <li key={routine.id}>
              <WorkoutRoutineCard routine={routine} />
            </li>
          ))}
        </ul>
      )}

      {sessions.length > 0 && (
        <>
          <Card variant="glass" padding="md">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Constancia
            </p>
            {/* 12 semanas: en mobile la grilla entra completa sin scroll horizontal. */}
            <StreakTracker
              className="mt-3"
              studiedDates={doneDates}
              weeks={12}
              goalPerWeek={week.total || 1}
            />
          </Card>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Días entrenados
            </p>
            <ul className="mt-2.5 space-y-2">
              {visibleSessions.map((session) => (
                <li key={session.date}>
                  <Card
                    variant="outline"
                    padding="sm"
                    interactive
                    onClick={() => openSessionSheet(session.date)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <span className="mr-1.5" aria-hidden="true">
                            {workoutTypeMeta(session.type).emoji}
                          </span>
                          {session.title}
                        </p>
                        {session.note && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">
                            {session.note}
                          </p>
                        )}
                        {session.routineName && (
                          <p className="mt-0.5 text-[11px] text-muted/80">
                            {session.routineName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {formatDay(session.date, today)}
                      </span>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            {sessions.length > HISTORY_PAGE && (
              <Button
                variant="ghost"
                fullWidth
                className="mt-2"
                onClick={() => setShowAllHistory((prev) => !prev)}
              >
                {showAllHistory
                  ? "Ver menos"
                  : `Ver los ${sessions.length} días entrenados`}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
