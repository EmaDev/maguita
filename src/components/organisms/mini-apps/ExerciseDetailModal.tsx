"use client";

import { Button, Modal } from "lib-kit-components";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/atoms/icons";
import {
  EQUIPMENT_LABELS,
  muscleGroupLabel,
  type ExerciseInfo,
} from "@/lib/exercise-catalog";

interface ExerciseDetailModalProps {
  /** `null` = cerrado. */
  exercise: ExerciseInfo | null;
  onClose: () => void;
  /** Sólo se ofrecen en los ejercicios propios: el catálogo base no se edita. */
  onEdit?: (exercise: ExerciseInfo) => void;
  onDelete?: (exercise: ExerciseInfo) => void;
  /** Suma este ejercicio a un día de una rutina. */
  onAddToRoutine?: (exercise: ExerciseInfo) => void;
  pending?: boolean;
}

/**
 * Ficha de un ejercicio: qué es, para qué sirve y cómo ejecutarlo. Es el
 * contenido que hace que la biblioteca sea algo más que una lista de nombres
 * — los consejos son los errores que más se ven en cada movimiento.
 */
export function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
  onDelete,
  onAddToRoutine,
  pending = false,
}: ExerciseDetailModalProps) {
  if (!exercise) return null;

  return (
    <Modal open onClose={onClose} title={exercise.name}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {muscleGroupLabel(exercise.group)}
          </span>
          <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-muted">
            {EQUIPMENT_LABELS[exercise.equipment]}
          </span>
          {exercise.custom && (
            <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[11px] font-semibold text-accent">
              Propio
            </span>
          )}
        </div>

        {exercise.description && (
          <p className="text-sm leading-relaxed">{exercise.description}</p>
        )}

        {exercise.tips.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Cómo ejecutarlo
            </p>
            <ul className="mt-2 space-y-2">
              {exercise.tips.map((tip) => (
                <li key={tip} className="flex gap-2 text-sm leading-relaxed">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onAddToRoutine && (
            <Button size="sm" onClick={() => onAddToRoutine(exercise)} disabled={pending}>
              <PlusIcon className="h-4 w-4" />
              Agregar a una rutina
            </Button>
          )}
          {exercise.custom && onEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(exercise)} disabled={pending}>
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
          )}
          {exercise.custom && onDelete && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Eliminar ${exercise.name}`}
              onClick={() => onDelete(exercise)}
              disabled={pending}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
