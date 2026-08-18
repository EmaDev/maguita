import Link from "next/link";
import { Card } from "lib-kit-components";
import { CheckIcon, ChevronRightIcon } from "@/components/atoms/icons";
import { routineDetailHref } from "@/lib/app-config";
import type { WorkoutRoutine } from "@/lib/data/workouts";
import { workoutTypeMeta } from "@/lib/workout-model";
import { WEEKDAY_INITIALS } from "./workout-options";

interface WorkoutRoutineCardProps {
  routine: WorkoutRoutine;
}

/**
 * Una rutina en la lista: tipo, días que entrena y si está activa. Es un link
 * al detalle (`/mini-apps/entrenamiento/rutinas/{id}`), no un acordeón.
 *
 * Antes desplegaba el plan entero acá adentro, y eso dejó de funcionar cuando
 * `detail` pasó a aceptar un WOD completo en vez de "4x10": seis días con sus
 * ejercicios y sus bloques, en el ancho de una fila de lista, es un muro de
 * texto — y encima varias cards abiertas a la vez se leen como una sola. La
 * lista volvió a ser lo que su nombre dice, y el plan se lee en la pantalla que
 * tiene lugar para mostrarlo.
 *
 * Tampoco monta acciones: un `<button>` adentro de un `<a>` no es HTML válido,
 * así que activar/editar/exportar/eliminar viven en el detalle. Al quedarse sin
 * estado ni handlers ya no necesita la directiva `"use client"` — igual viaja
 * en el bundle del cliente, porque quien la monta (`WorkoutRoutinesPanel`) sí
 * es un Client Component; lo que se fue es la razón para declararla.
 */
export function WorkoutRoutineCard({ routine }: WorkoutRoutineCardProps) {
  const type = workoutTypeMeta(routine.type);
  const trained = new Set(routine.days.map((day) => day.weekday));

  return (
    <Card variant="glass" padding="sm">
      {/* Sin `aria-label`: pisaría el contenido del link, que ya dice el
          nombre, el tipo, los días y si está activa. */}
      <Link href={routineDetailHref(routine.id)} className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
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

          {/* La descripción se corta en una línea: es una bajada, y dejarla
              envolver era lo que descuadraba las filas de la lista. Completa se
              ve en el detalle. */}
          <span className="mt-0.5 block truncate text-xs text-muted">
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
        </span>

        <ChevronRightIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </Card>
  );
}
