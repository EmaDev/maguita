"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Button, ChipCarousel, Input } from "lib-kit-components";
import { CheckIcon } from "@/components/atoms/icons";
import {
  EQUIPMENT_LABELS,
  filterExercises,
  MUSCLE_GROUPS,
  muscleGroupLabel,
  type ExerciseInfo,
  type MuscleGroup,
} from "@/lib/exercise-catalog";

const GROUP_CHIPS = [
  { id: "todos", label: "Todos" },
  ...MUSCLE_GROUPS.map((group) => ({ id: group.id, label: `${group.emoji} ${group.label}` })),
];

interface ExercisePickerSheetProps {
  /** Catálogo + ejercicios propios, ya mezclados (`mergeExercises`). */
  exercises: ExerciseInfo[];
  /** Texto del botón de confirmación, ej. "Agregar 3 ejercicios". */
  confirmLabel?: (count: number) => string;
  onConfirm: (selected: ExerciseInfo[]) => void;
}

/**
 * Selector múltiple de ejercicios de la biblioteca, para el `BottomSheet`.
 *
 * Tiene buscador y filtro por grupo propios (no usa el del header) porque
 * vive dentro de un sheet, que puede estar abierto sobre cualquiera de las
 * dos tabs: el buscador del shell filtra la pantalla de atrás, no esto.
 *
 * La selección es estado local y sólo se emite al confirmar: quien lo usa
 * decide qué hacer con ella — el composer la agrega al día que está editando
 * (sin tocar Firestore hasta guardar la rutina), y la biblioteca la manda a
 * `addExercisesToRoutineDayAction`.
 */
export function ExercisePickerSheet({
  exercises,
  confirmLabel,
  onConfirm,
}: ExercisePickerSheetProps) {
  const [term, setTerm] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "todos">("todos");
  const [selected, setSelected] = useState<string[]>([]);

  const visible = useMemo(
    () => filterExercises(exercises, term, group),
    [exercises, term, group]
  );

  const selectedSet = new Set(selected);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }

  function confirm() {
    /* Se emite en el orden en que el usuario los fue tocando, no en el de la
       lista: si eligió sentadilla y después prensa, ese es el orden en que
       espera verlos en el día. */
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    onConfirm(selected.map((id) => byId.get(id)).filter((entry): entry is ExerciseInfo => !!entry));
  }

  return (
    <div className="space-y-3 py-1">
      <Input
        placeholder="Buscar ejercicio…"
        value={term}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTerm(e.target.value)}
      />

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
        <p className="py-8 text-center text-sm text-muted">
          Ningún ejercicio coincide con esa búsqueda.
        </p>
      ) : (
        /* Alto acotado con scroll propio: el sheet no puede crecer con 100
           ejercicios, y el botón de confirmar tiene que quedar siempre visible. */
        <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
          {visible.map((exercise) => {
            const picked = selectedSet.has(exercise.id);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => toggle(exercise.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    picked ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{exercise.name}</span>
                    <span className="block text-[11px] text-muted">
                      {muscleGroupLabel(exercise.group)} · {EQUIPMENT_LABELS[exercise.equipment]}
                      {exercise.custom && " · Propio"}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      picked ? "border-primary bg-primary text-white" : "border-border"
                    }`}
                  >
                    {picked && <CheckIcon className="h-3 w-3" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button fullWidth onClick={confirm} disabled={selected.length === 0}>
        {confirmLabel
          ? confirmLabel(selected.length)
          : selected.length === 1
            ? "Agregar 1 ejercicio"
            : `Agregar ${selected.length} ejercicios`}
      </Button>
    </div>
  );
}
