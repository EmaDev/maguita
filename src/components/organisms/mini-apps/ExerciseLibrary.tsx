"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { Button, Card, ChipCarousel, useSnackbar } from "lib-kit-components";
import { CheckIcon, PlusIcon } from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellSearch } from "@/components/shell/shell-search";
import { deleteCustomExerciseAction } from "@/lib/data/exercises-actions";
import type { WorkoutRoutine } from "@/lib/data/workouts";
import {
  EQUIPMENT_LABELS,
  filterExercises,
  mergeExercises,
  MUSCLE_GROUPS,
  muscleGroupLabel,
  type ExerciseInfo,
  type MuscleGroup,
} from "@/lib/exercise-catalog";
import { AddToRoutineSheet } from "./AddToRoutineSheet";
import { ExerciseComposer } from "./ExerciseComposer";
import { ExerciseDetailModal } from "./ExerciseDetailModal";

const GROUP_CHIPS = [
  { id: "todos", label: "Todos" },
  ...MUSCLE_GROUPS.map((group) => ({ id: group.id, label: `${group.emoji} ${group.label}` })),
];

interface ExerciseLibraryProps {
  /** Ejercicios propios del usuario. El catálogo base se importa, no viaja como prop. */
  customExercises: ExerciseInfo[];
  routines: WorkoutRoutine[];
}

/**
 * Biblioteca de ejercicios: el catálogo estático más los del usuario, con su
 * descripción y sus consejos de ejecución, y el ABM de los propios.
 *
 * Tiene dos modos. En el normal, tocar un ejercicio abre su ficha. Con
 * "Elegir" se entra en modo selección: tocar marca y destildar, y el botón de
 * abajo manda todo lo elegido a un día de una rutina. Es un modo aparte y no
 * un checkbox siempre visible porque el uso más frecuente de esta pantalla es
 * consultar cómo se hace un ejercicio, no armar rutinas.
 */
export function ExerciseLibrary({ customExercises, routines }: ExerciseLibraryProps) {
  const { snack } = useSnackbar();
  const { openSheet, closeSheet } = useAppSheet();
  const { query, setQuery } = useShellSearch();
  const [pending, startTransition] = useTransition();

  const [group, setGroup] = useState<MuscleGroup | "todos">("todos");
  const [detail, setDetail] = useState<ExerciseInfo | null>(null);
  /** `null` = modo consulta. Un array (aunque esté vacío) = modo selección. */
  const [picked, setPicked] = useState<string[] | null>(null);

  const all = useMemo(() => mergeExercises(customExercises), [customExercises]);
  const visible = useMemo(() => filterExercises(all, query, group), [all, query, group]);

  const selecting = picked !== null;
  const pickedSet = new Set(picked ?? []);

  function openComposer(exercise?: ExerciseInfo) {
    setDetail(null);
    openSheet(<ExerciseComposer exercise={exercise} onSaved={() => closeSheet()} />, {
      title: exercise ? "Editar ejercicio" : "Nuevo ejercicio",
    });
  }

  function openAddToRoutine(exercises: ExerciseInfo[]) {
    if (exercises.length === 0) return;
    setDetail(null);
    openSheet(
      <AddToRoutineSheet
        exercises={exercises}
        routines={routines}
        onSaved={() => {
          closeSheet();
          setPicked(null);
        }}
      />,
      { title: "Agregar a una rutina" }
    );
  }

  function remove(exercise: ExerciseInfo) {
    startTransition(async () => {
      try {
        await deleteCustomExerciseAction(exercise.id);
        setDetail(null);
        snack({ message: "Ejercicio eliminado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar el ejercicio.",
          variant: "error",
        });
      }
    });
  }

  function toggle(exercise: ExerciseInfo) {
    setPicked((prev) => {
      const current = prev ?? [];
      return current.includes(exercise.id)
        ? current.filter((id) => id !== exercise.id)
        : [...current, exercise.id];
    });
  }

  const pickedExercises = (picked ?? [])
    .map((id) => all.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is ExerciseInfo => !!exercise);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {all.length} ejercicios
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPicked((prev) => (prev === null ? [] : null))}
          >
            {selecting ? "Cancelar" : "Elegir"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openComposer()}>
            <PlusIcon className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      <ChipCarousel
        chips={GROUP_CHIPS}
        value={group}
        size="sm"
        clearable={false}
        onChange={(next: string | string[]) => {
          if (!Array.isArray(next)) setGroup(next as MuscleGroup | "todos");
        }}
      />

      {visible.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">
            Ningún ejercicio coincide {query.trim() ? `con “${query}”` : "con ese filtro"}.
          </p>
          {query.trim() && (
            <Button variant="ghost" className="mt-2" onClick={() => setQuery("")}>
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((exercise) => {
            const isPicked = pickedSet.has(exercise.id);
            return (
              <li key={exercise.id}>
                <Card
                  variant={isPicked ? "outline" : "glass"}
                  padding="sm"
                  interactive
                  className={isPicked ? "border-primary bg-primary/10" : undefined}
                  onClick={() => (selecting ? toggle(exercise) : setDetail(exercise))}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{exercise.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {muscleGroupLabel(exercise.group)} ·{" "}
                        {EQUIPMENT_LABELS[exercise.equipment]}
                        {exercise.custom && " · Propio"}
                      </p>
                      {!selecting && exercise.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                          {exercise.description}
                        </p>
                      )}
                    </div>

                    {selecting ? (
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          isPicked ? "border-primary bg-primary text-white" : "border-border"
                        }`}
                      >
                        {isPicked && <CheckIcon className="h-3 w-3" />}
                      </span>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Agregar ${exercise.name} a una rutina`}
                        disabled={pending}
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          openAddToRoutine([exercise]);
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Barra de acción del modo selección. `sticky` abajo para que no haya
          que scrollear hasta el final de 100 ejercicios para confirmar. */}
      {selecting && (
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <Button
            fullWidth
            disabled={pickedExercises.length === 0}
            onClick={() => openAddToRoutine(pickedExercises)}
          >
            {pickedExercises.length === 0
              ? "Elegí ejercicios para agregar"
              : pickedExercises.length === 1
                ? "Agregar 1 ejercicio a una rutina"
                : `Agregar ${pickedExercises.length} ejercicios a una rutina`}
          </Button>
        </div>
      )}

      <ExerciseDetailModal
        exercise={detail}
        pending={pending}
        onClose={() => setDetail(null)}
        onEdit={openComposer}
        onDelete={remove}
        onAddToRoutine={(exercise) => openAddToRoutine([exercise])}
      />
    </div>
  );
}
