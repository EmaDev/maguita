"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Card } from "lib-kit-components";
import { CheckIcon, ChevronDownIcon, PencilIcon, ShareIcon, TrashIcon } from "@/components/atoms/icons";
import type { WorkoutRoutine } from "@/lib/data/workouts";
import { workoutTypeMeta } from "@/lib/workout-model";
import { WEEKDAY_INITIALS } from "./workout-options";

interface WorkoutRoutineCardProps {
  routine: WorkoutRoutine;
  pending: boolean;
  /**
   * `true` si ese `exerciseId` resuelve contra la biblioteca. Las filas
   * escritas a mano (o las que apuntan a un ejercicio propio ya borrado) no
   * tienen ficha que mostrar, así que no se pintan como tocables.
   */
  hasExerciseInfo: (exerciseId: string | null) => boolean;
  /** Abre la ficha del ejercicio: descripción y consejos de ejecución. */
  onShowExercise: (exerciseId: string) => void;
  onActivate: (routine: WorkoutRoutine) => void;
  onEdit: (routine: WorkoutRoutine) => void;
  onExport: (routine: WorkoutRoutine) => void;
  onRemove: (routine: WorkoutRoutine) => void;
}

/**
 * Una rutina de la lista: tipo, días que entrena y, desplegado, qué toca cada
 * día con sus ejercicios. Colapsada por default — la lista es para elegir
 * cuál activar, no para leer el plan entero (eso se lee en la card de "Hoy" y
 * al registrar el día).
 */
export function WorkoutRoutineCard({
  routine,
  pending,
  hasExerciseInfo,
  onShowExercise,
  onActivate,
  onEdit,
  onExport,
  onRemove,
}: WorkoutRoutineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const type = workoutTypeMeta(routine.type);
  const trained = new Set(routine.days.map((day) => day.weekday));

  return (
    <Card variant="glass" padding="sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">
              {type.emoji}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">{routine.name}</span>
            {routine.active && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">
                <CheckIcon className="h-3 w-3" />
                Activa
              </span>
            )}
          </span>

          <span className="mt-0.5 block text-xs text-muted">
            {type.label} · {routine.days.length}{" "}
            {routine.days.length === 1 ? "día" : "días"} por semana
            {routine.description && ` · ${routine.description}`}
          </span>

          <span className="mt-1.5 flex gap-1">
            {WEEKDAY_INITIALS.map(({ weekday, label }, index) => (
              <span
                key={`${weekday}-${index}`}
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-semibold ${
                  trained.has(weekday) ? "bg-primary/15 text-primary" : "text-muted/50"
                }`}
              >
                {label}
              </span>
            ))}
          </span>
        </button>

        <ChevronDownIcon
          aria-hidden="true"
          className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="mt-3 space-y-2.5">
              {routine.days.map((day) => (
                <li key={day.weekday}>
                  <p className="text-xs font-semibold">{day.title}</p>
                  {day.exercises.length === 0 ? (
                    <p className="text-xs text-muted">Sin ejercicios cargados.</p>
                  ) : (
                    <ul className="mt-0.5 space-y-1.5">
                      {day.exercises.map((exercise) => {
                        const withInfo = hasExerciseInfo(exercise.exerciseId);
                        return (
                          <li key={exercise.id} className="text-xs text-muted">
                            <button
                              type="button"
                              disabled={!withInfo}
                              // Sin ficha no es un botón útil: se deja como
                              // texto plano, sin cursor ni subrayado que
                              // prometan algo que no va a pasar.
                              onClick={() => withInfo && onShowExercise(exercise.exerciseId!)}
                              // `flex-wrap` y no `shrink-0`: un detalle corto
                              // ("4x10") sigue quedando a la derecha del
                              // nombre, y uno largo (un WOD entero) baja a su
                              // propio renglón y envuelve en vez de reventar la
                              // fila. Sin `truncate`: con el detalle ya
                              // envolviendo, cortar el nombre con puntitos sólo
                              // esconde información que ahora cabe.
                              className={`flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-left ${
                                withInfo ? "text-primary/90 underline decoration-dotted" : ""
                              }`}
                            >
                              <span className="min-w-0">{exercise.name}</span>
                              {exercise.detail && (
                                <span className="min-w-0 text-muted/80">{exercise.detail}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center gap-1">
              {!routine.active && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onActivate(routine)}
                >
                  Activar
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Editar ${routine.name}`}
                disabled={pending}
                onClick={() => onEdit(routine)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Exportar ${routine.name} como JSON`}
                onClick={() => onExport(routine)}
              >
                <ShareIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar ${routine.name}`}
                disabled={pending}
                onClick={() => onRemove(routine)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
