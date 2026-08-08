"use client";

import { useState, useTransition } from "react";
import { Button, useSnackbar } from "lib-kit-components";
import { addExercisesToRoutineDayAction } from "@/lib/data/workouts-actions";
import type { WorkoutRoutine } from "@/lib/data/workouts";
import type { ExerciseInfo } from "@/lib/exercise-catalog";
import { workoutTypeMeta } from "@/lib/workout-model";

const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

interface AddToRoutineSheetProps {
  /** Ejercicios elegidos en la biblioteca. */
  exercises: ExerciseInfo[];
  routines: WorkoutRoutine[];
  onSaved: () => void;
}

/**
 * Último paso del camino "de la biblioteca a la rutina": elegidos los
 * ejercicios, hay que decir a qué rutina y a qué día van.
 *
 * Sólo se ofrecen los días que la rutina ya tiene: agregar un día nuevo es
 * una decisión sobre el plan (cambia la meta semanal y la racha), no algo
 * que deba pasar de costado al sumar un ejercicio. Para eso está el composer
 * de la rutina.
 */
export function AddToRoutineSheet({ exercises, routines, onSaved }: AddToRoutineSheetProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [routineId, setRoutineId] = useState(
    () => routines.find((routine) => routine.active)?.id ?? routines[0]?.id ?? ""
  );

  const routine = routines.find((entry) => entry.id === routineId) ?? null;

  function add(weekday: number) {
    if (!routine) return;
    startTransition(async () => {
      try {
        await addExercisesToRoutineDayAction(
          routine.id,
          weekday,
          exercises.map((exercise) => ({
            id: crypto.randomUUID(),
            name: exercise.name,
            detail: null,
            exerciseId: exercise.id,
          }))
        );
        snack({
          message:
            exercises.length === 1
              ? `«${exercises[0]!.name}» agregado.`
              : `${exercises.length} ejercicios agregados.`,
          variant: "success",
        });
        onSaved();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudieron agregar.",
          variant: "error",
        });
      }
    });
  }

  if (routines.length === 0) {
    return (
      <p className="py-4 text-sm leading-relaxed text-muted">
        Todavía no tenés ninguna rutina. Creá una desde la tab Rutinas y después vas a poder
        sumarle ejercicios desde acá.
      </p>
    );
  }

  return (
    <div className="space-y-4 py-1">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Se agregan {exercises.length === 1 ? "1 ejercicio" : `${exercises.length} ejercicios`}
        </p>
        <p className="mt-1 text-sm">{exercises.map((exercise) => exercise.name).join(", ")}</p>
      </div>

      {routines.length > 1 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Rutina
          </p>
          <div className="space-y-1.5">
            {routines.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === routineId}
                onClick={() => setRoutineId(entry.id)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  entry.id === routineId
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span aria-hidden="true">{workoutTypeMeta(entry.type).emoji}</span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                {entry.active && <span className="shrink-0 text-[11px] text-success">Activa</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          ¿A qué día?
        </p>
        {routine && routine.days.length > 0 ? (
          <div className="space-y-1.5">
            {routine.days.map((day) => (
              <Button
                key={day.weekday}
                fullWidth
                variant="outline"
                disabled={pending}
                onClick={() => add(day.weekday)}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {DAY_LABELS[day.weekday]} · {day.title}
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Esa rutina no tiene días cargados.</p>
        )}
      </div>
    </div>
  );
}
