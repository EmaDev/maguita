"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { Button, ChipCarousel, Input, Textarea, useSnackbar } from "lib-kit-components";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@/components/atoms/icons";
import {
  addRoutineAction,
  updateRoutineAction,
  type WorkoutDayInput,
} from "@/lib/data/workouts-actions";
import type { WorkoutRoutine } from "@/lib/data/workouts";
import type { WorkoutType } from "@/lib/firebase/collections";
import { mergeExercises, type ExerciseInfo } from "@/lib/exercise-catalog";
import { DEFAULT_WORKOUT_TYPE, WEEK_ORDER, sortByWeek } from "@/lib/workout-model";
import { ExercisePickerSheet } from "./ExercisePickerSheet";
import { WEEKDAY_CHIPS, WEEKDAY_LABELS, WORKOUT_TYPE_CHIPS } from "./workout-options";

/** Mismos topes que `workouts-actions.ts`: el server igual los valida. */
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 140;
const MAX_DAY_TITLE_LENGTH = 60;
const MAX_EXERCISE_NAME_LENGTH = 60;
const MAX_EXERCISE_DETAIL_LENGTH = 200;
const MAX_EXERCISES_PER_DAY = 30;

interface RoutineComposerProps {
  /** Rutina a editar. Ausente = alta de una nueva. */
  routine?: WorkoutRoutine;
  /** Ejercicios propios del usuario, para mezclarlos con el catálogo en el picker. */
  customExercises: ExerciseInfo[];
  /** Lo llama el sheet al guardar bien, para cerrarse. */
  onSaved: () => void;
}

/**
 * Formulario de alta y edición de una rutina, para el `BottomSheet` global
 * (`useAppSheet`). Alta y edición comparten componente porque los campos son
 * los mismos: sólo cambia contra qué Server Action se guarda.
 *
 * Los días **no** se agregan de a uno con un selector: se marcan en el
 * `ChipCarousel` de la semana (mismo patrón que el horario de un hábito) y
 * cada día marcado abre su propio bloque con el título y sus ejercicios.
 * Desmarcar un día esconde su bloque pero **conserva el borrador** en
 * memoria, así un toque accidental no borra media rutina cargada; sólo se
 * manda lo que quedó marcado al guardar.
 */
export function WorkoutRoutineComposer({
  routine,
  customExercises,
  onSaved,
}: RoutineComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  /**
   * Biblioteca del picker. `null` = picker cerrado; con un `weekday`, se
   * muestra en lugar del formulario. Es una vista dentro del mismo sheet y no
   * un sheet nuevo: `useAppSheet` monta uno solo, así que abrir el picker
   * desde acá reemplazaría el formulario a medio completar.
   */
  const exercises = useMemo(() => mergeExercises(customExercises), [customExercises]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const [name, setName] = useState(routine?.name ?? "");
  const [type, setType] = useState<WorkoutType>(routine?.type ?? DEFAULT_WORKOUT_TYPE);
  const [description, setDescription] = useState(routine?.description ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(
    () => routine?.days.map((day) => day.weekday) ?? []
  );
  const [drafts, setDrafts] = useState<Record<number, WorkoutDayInput>>(() =>
    Object.fromEntries((routine?.days ?? []).map((day) => [day.weekday, day]))
  );

  /** Sólo los días marcados, en orden de semana — es lo que se guarda y lo que se muestra. */
  const days = sortByWeek(
    weekdays.map(
      (weekday) => drafts[weekday] ?? { weekday, title: "", exercises: [] }
    )
  );

  const valid =
    !!name.trim() && weekdays.length > 0 && days.every((day) => day.title.trim());

  function patchDay(weekday: number, patch: Partial<WorkoutDayInput>) {
    setDrafts((prev) => {
      const current = prev[weekday] ?? { weekday, title: "", exercises: [] };
      return { ...prev, [weekday]: { ...current, ...patch } };
    });
  }

  function addExercise(day: WorkoutDayInput) {
    patchDay(day.weekday, {
      exercises: [
        ...day.exercises,
        { id: crypto.randomUUID(), name: "", detail: null, exerciseId: null },
      ],
    });
  }

  /**
   * Suma al día lo elegido en la biblioteca. El nombre se **copia** y queda
   * editable como cualquier otra fila; `exerciseId` guarda de dónde salió,
   * que es lo que después permite abrir su ficha desde la rutina.
   */
  function addFromLibrary(weekday: number, picked: ExerciseInfo[]) {
    const day = drafts[weekday] ?? { weekday, title: "", exercises: [] };
    patchDay(weekday, {
      exercises: [
        ...day.exercises,
        ...picked.map((exercise) => ({
          id: crypto.randomUUID(),
          name: exercise.name,
          detail: null,
          exerciseId: exercise.id,
        })),
      ],
    });
    setPickerFor(null);
  }

  function patchExercise(
    day: WorkoutDayInput,
    exerciseId: string,
    patch: { name?: string; detail?: string }
  ) {
    patchDay(day.weekday, {
      exercises: day.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
      ),
    });
  }

  function removeExercise(day: WorkoutDayInput, exerciseId: string) {
    patchDay(day.weekday, {
      exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId),
    });
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        const fields = {
          name: name.trim(),
          type,
          description: description.trim() || null,
          days,
        };
        if (routine) {
          await updateRoutineAction({ id: routine.id, ...fields });
        } else {
          await addRoutineAction(fields);
        }
        snack({
          message: routine ? "Rutina actualizada." : "Rutina creada.",
          variant: "success",
        });
        onSaved();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar la rutina.",
          variant: "error",
        });
      }
    });
  }

  if (pickerFor !== null) {
    return (
      <div className="space-y-3 py-1">
        <Button size="sm" variant="ghost" onClick={() => setPickerFor(null)}>
          <ArrowLeftIcon className="h-4 w-4" />
          Volver a {WEEKDAY_LABELS[pickerFor]}
        </Button>
        <ExercisePickerSheet
          exercises={exercises}
          confirmLabel={(count) =>
            count === 1 ? "Agregar 1 ejercicio al día" : `Agregar ${count} ejercicios al día`
          }
          onConfirm={(picked) => addFromLibrary(pickerFor, picked)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-1">
      <Input
        label="Nombre"
        placeholder="Ej. Full body 3 días"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Tipo de entrenamiento
        </p>
        <ChipCarousel
          chips={WORKOUT_TYPE_CHIPS}
          value={type}
          size="sm"
          clearable={false}
          onChange={(next: string | string[]) => {
            // Sin `multi`, siempre llega un id suelto — el tipo de la librería
            // es el mismo para los dos modos.
            if (!Array.isArray(next)) setType(next as WorkoutType);
          }}
        />
      </div>

      <Input
        label="Descripción (opcional)"
        placeholder="Ej. Fuerza general, 3 veces por semana"
        value={description}
        maxLength={MAX_DESCRIPTION_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
      />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Días de entrenamiento
        </p>
        <ChipCarousel
          chips={WEEKDAY_CHIPS}
          value={weekdays.map(String)}
          multi
          size="sm"
          onChange={(next: string | string[]) => {
            if (!Array.isArray(next)) return;
            const selected = next.map(Number);
            setWeekdays(WEEK_ORDER.filter((weekday) => selected.includes(weekday)));
          }}
        />
        {weekdays.length === 0 && (
          <p className="mt-1.5 text-xs text-danger">Elegí al menos un día.</p>
        )}
      </div>

      {days.map((day) => (
        <div key={day.weekday} className="rounded-2xl border border-border p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            {WEEKDAY_LABELS[day.weekday]}
          </p>

          <Input
            label="Qué toca"
            placeholder="Ej. Pecho y tríceps"
            value={day.title}
            maxLength={MAX_DAY_TITLE_LENGTH}
            disabled={pending}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              patchDay(day.weekday, { title: e.target.value })
            }
          />

          <div className="mt-3 space-y-3">
            {day.exercises.map((exercise, index) => (
              /* El detalle va **debajo** del nombre, no al lado: entra un WOD
                 entero (`MAX_EXERCISE_DETAIL_LENGTH`) y en una columna angosta
                 se leería de a tres palabras. `autoResize` con `rows={1}` lo
                 deja del alto de un input mientras diga "4x10" —el caso de
                 gimnasio— y lo estira solo cuando hay un bloque escrito. */
              <div key={exercise.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    placeholder={`Ejercicio ${index + 1}`}
                    value={exercise.name}
                    maxLength={MAX_EXERCISE_NAME_LENGTH}
                    disabled={pending}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      patchExercise(day, exercise.id, { name: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder="4x10, 20 min, o el bloque completo"
                    value={exercise.detail ?? ""}
                    rows={1}
                    autoResize
                    maxLength={MAX_EXERCISE_DETAIL_LENGTH}
                    disabled={pending}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      patchExercise(day, exercise.id, { detail: e.target.value })
                    }
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar ejercicio ${index + 1}`}
                  onClick={() => removeExercise(day, exercise.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {day.exercises.length < MAX_EXERCISES_PER_DAY && (
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPickerFor(day.weekday)}>
                <PlusIcon className="h-4 w-4" />
                Elegir de la biblioteca
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addExercise(day)}>
                Escribir a mano
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {routine ? "Guardar cambios" : "Crear rutina"}
      </Button>
    </div>
  );
}
