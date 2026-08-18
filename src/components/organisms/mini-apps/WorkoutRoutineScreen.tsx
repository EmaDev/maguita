"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, TabsCarousel, useSnackbar } from "lib-kit-components";
import {
  CheckIcon,
  PencilIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/atoms/icons";
import { WorkoutDayShareSheet } from "./WorkoutDayShareSheet";
import { useAppSheet } from "@/components/shell/app-sheet";
import { ROUTES } from "@/lib/app-config";
import {
  activateRoutineAction,
  deleteRoutineAction,
} from "@/lib/data/workouts-actions";
import type { WorkoutRoutine, WorkoutRoutineDay } from "@/lib/data/workouts";
import { mergeExercises, type ExerciseInfo } from "@/lib/exercise-catalog";
import { weekdayOf } from "@/lib/home-model";
import { splitDetail, workoutTypeMeta } from "@/lib/workout-model";
import { ExerciseDetailModal } from "./ExerciseDetailModal";
import { WorkoutRoutineComposer } from "./WorkoutRoutineComposer";
import {
  WEEKDAY_INITIALS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  routineToJson,
} from "./workout-options";

interface WorkoutRoutineScreenProps {
  routine: WorkoutRoutine;
  /** Día de referencia (`yyyy-mm-dd`) resuelto en el server: que el cliente no lo recalcule evita un mismatch de hidratación entre husos. */
  today: string;
  /** Ejercicios propios, para resolver la ficha de cada fila y para el picker del composer. */
  customExercises: ExerciseInfo[];
}

/**
 * Detalle de una rutina (`/mini-apps/entrenamiento/rutinas/{routineId}`): el
 * plan completo con **una tab por día** y las acciones sobre la rutina.
 *
 * Existe porque la lista de rutinas no da para leer un plan. Cada card
 * desplegaba los días con todos sus ejercicios en el mismo ancho de una fila
 * de lista, y con los detalles largos que ahora acepta `detail` (un WOD entero,
 * no "4x10") eso se volvía un bloque de texto ilegible. Acá cada día tiene la
 * pantalla entera, así que el plan se lee de a un día — que además es como se
 * usa: uno entrena el día que le toca, no los siete juntos.
 *
 * Las acciones de la rutina (activar, editar, exportar, eliminar) viven acá y
 * no en la lista: la card volvió a ser un link, y un `<button>` adentro de un
 * `<a>` no es HTML válido. El costo es un toque más para activar; a cambio, la
 * decisión de activar se toma **después** de leer el plan, que es cuando se
 * puede tomar.
 */
export function WorkoutRoutineScreen({
  routine,
  today,
  customExercises,
}: WorkoutRoutineScreenProps) {
  const router = useRouter();
  const { snack } = useSnackbar();
  const { openSheet, closeSheet } = useAppSheet();
  const [pending, startTransition] = useTransition();
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseInfo | null>(null);

  const type = workoutTypeMeta(routine.type);
  const trained = useMemo(
    () => new Set(routine.days.map((day) => day.weekday)),
    [routine.days]
  );

  /** Biblioteca indexada por id, para abrir la ficha de una fila sin ir al tab de Ejercicios. */
  const exerciseById = useMemo(
    () => new Map(mergeExercises(customExercises).map((exercise) => [exercise.id, exercise])),
    [customExercises]
  );

  /**
   * Arranca en el día de hoy si la rutina entrena hoy, y si no en el primero de
   * la semana (`routine.days` ya viene ordenado desde el lunes). Entrar en el
   * lunes cuando es jueves obliga a buscar la tab correcta todas las veces.
   */
  const todayWeekday = weekdayOf(today);
  const [openDay, setOpenDay] = useState(() =>
    String(trained.has(todayWeekday) ? todayWeekday : (routine.days[0]?.weekday ?? todayWeekday))
  );

  function openEditSheet() {
    openSheet(
      <WorkoutRoutineComposer
        routine={routine}
        customExercises={customExercises}
        onSaved={closeSheet}
      />,
      { title: "Editar rutina" }
    );
  }

  function activate() {
    startTransition(async () => {
      try {
        await activateRoutineAction(routine.id);
        snack({ message: `«${routine.name}» es tu rutina activa.`, variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo activar la rutina.",
          variant: "error",
        });
      }
    });
  }

  /**
   * Al borrar hay que salir de esta pantalla: su documento ya no existe, y
   * quedarse acá mostraría un detalle fantasma hasta el próximo render.
   * `replace` y no `push` para que el botón de volver no traiga de nuevo un
   * detalle que ahora es un 404.
   */
  function remove() {
    startTransition(async () => {
      try {
        await deleteRoutineAction(routine.id);
        snack({ message: "Rutina eliminada.", variant: "success" });
        router.replace(ROUTES.miniAppEntrenamiento);
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar la rutina.",
          variant: "error",
        });
      }
    });
  }

  /**
   * Exporta al portapapeles en el mismo formato que acepta la importación, que
   * es lo que hace que una rutina se pueda pasar de una cuenta a otra.
   * `navigator.clipboard` no existe fuera de un contexto seguro (o si el
   * usuario denegó el permiso): en ese caso se cae al sheet con el JSON a la
   * vista para copiarlo a mano, en vez de fallar sin alternativa.
   */
  function exportRoutine() {
    const json = routineToJson(routine);

    const showJson = () =>
      openSheet(
        <pre className="max-h-80 overflow-auto rounded-xl bg-surface-alt p-3 text-[11px] leading-relaxed">
          {json}
        </pre>,
        { title: routine.name, description: "Copiá el JSON a mano." }
      );

    // `navigator.clipboard` es `undefined` fuera de un contexto seguro, así
    // que se chequea antes de encadenar el `.then` en vez de con `?.`.
    if (!navigator.clipboard) {
      showJson();
      return;
    }
    navigator.clipboard.writeText(json).then(
      () => snack({ message: "JSON copiado al portapapeles.", variant: "success" }),
      showJson
    );
  }

  const dayTabs = routine.days.map((day) => ({
    id: String(day.weekday),
    label: WEEKDAY_SHORT[day.weekday] ?? "?",
    // El día que toca hoy se marca en la tab: es el que se viene a leer.
    badge: day.weekday === todayWeekday ? "hoy" : undefined,
  }));

  function openShareSheet(day: WorkoutRoutineDay) {
    openSheet(<WorkoutDayShareSheet routine={routine} day={day} />, {
      title: `Compartir ${WEEKDAY_LABELS[day.weekday] ?? "el día"}`,
      description: day.title,
    });
  }

  const dayPanels = Object.fromEntries(
    routine.days.map((day) => [
      String(day.weekday),
      <RoutineDayPanel
        key={day.weekday}
        day={day}
        exerciseById={exerciseById}
        onShowExercise={setExerciseDetail}
        onShare={() => openShareSheet(day)}
      />,
    ])
  );

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="mr-1" aria-hidden="true">
              {type.emoji}
            </span>
            {type.label}
          </p>
          {routine.active && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
              <CheckIcon className="h-3.5 w-3.5" />
              Activa
            </span>
          )}
        </div>

        {/* h2 y no h1: el `title` del `AppHeader` del shell ya es el h1 de la
            pantalla, así que el nombre de la rutina cuelga de ese nivel. */}
        <h2 className="mt-1 text-xl font-semibold text-foreground">{routine.name}</h2>

        {routine.description && (
          <p className="mt-1 text-sm leading-relaxed text-muted">{routine.description}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="flex gap-1">
            {WEEKDAY_INITIALS.map(({ weekday, label }, index) => (
              <span
                key={`${weekday}-${index}`}
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                  trained.has(weekday) ? "bg-primary/15 text-primary" : "text-muted/50"
                }`}
              >
                {label}
              </span>
            ))}
          </span>
          <span className="text-xs text-muted">
            {routine.days.length} {routine.days.length === 1 ? "día" : "días"} por semana
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
          {!routine.active && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={activate}>
              <CheckIcon className="h-4 w-4" />
              Activar
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={openEditSheet}>
            <PencilIcon className="h-4 w-4" />
            Editar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Exportar ${routine.name} como JSON`}
            onClick={exportRoutine}
          >
            <ShareIcon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Eliminar ${routine.name}`}
            disabled={pending}
            onClick={remove}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {routine.days.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Esta rutina no tiene días cargados. Editala para agregarlos.
        </p>
      ) : (
        /* `panels` es lo que hace que el día entre deslizándose desde el lado
           al que se navega (martes → miércoles entra por la derecha), que es la
           razón de usar `TabsCarousel` y no `Tabs`.

           El `overflow-x-auto` va sobre el `[role=tablist]` y no sobre el
           componente entero: `TabsCarousel` no tiene prop `scrollable` (su
           tablist es un `flex gap-6` de botones `whitespace-nowrap`), así que
           una rutina de 6 o 7 días se clipearía. Scrollear el componente entero
           no serviría — el panel del día es hermano del tablist adentro del
           mismo div, y se iría de ancho junto con las tabs. Se engancha por el
           rol ARIA, que es parte del contrato del componente, y no por una clase
           interna. */
        <div className="[&_[role=tablist]]:overflow-x-auto [&_[role=tablist]]:scrollbar-none">
          <TabsCarousel
            items={dayTabs}
            value={openDay}
            onChange={setOpenDay}
            size="sm"
            panels={dayPanels}
          />
        </div>
      )}

      {/* Ficha del ejercicio. Sin acciones de ABM: crear, editar y borrar
          viven en la tab Ejercicios. */}
      <ExerciseDetailModal exercise={exerciseDetail} onClose={() => setExerciseDetail(null)} />
    </div>
  );
}

interface RoutineDayPanelProps {
  day: WorkoutRoutineDay;
  exerciseById: Map<string, ExerciseInfo>;
  onShowExercise: (exercise: ExerciseInfo) => void;
  /** Abre el sheet para compartir **este** día como imagen. */
  onShare: () => void;
}

/**
 * Un día del plan. Los ejercicios van numerados y de a uno por bloque, con el
 * nombre arriba y el detalle debajo: es el orden en que se ejecutan, así que la
 * numeración no es decorativa — es la que deja seguir el plan sin contar filas.
 *
 * El detalle largo se abre como lista de movimientos (`splitDetail`) en vez de
 * quedar como un párrafo corrido, que es lo único que se puede hacer mientras
 * `detail` sea texto libre.
 */
function RoutineDayPanel({
  day,
  exerciseById,
  onShowExercise,
  onShare,
}: RoutineDayPanelProps) {
  return (
    <Card variant="glass" padding="md">
      {/* El botón de compartir va en el encabezado del día y no abajo de la
          lista: compartir es una acción sobre *este* día, y con un plan largo
          un botón al final queda a un scroll de distancia de su contexto. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {WEEKDAY_LABELS[day.weekday]}
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{day.title}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          aria-label={`Compartir ${WEEKDAY_LABELS[day.weekday] ?? "el día"}`}
          onClick={onShare}
        >
          <ShareIcon className="h-4 w-4" />
          Compartir
        </Button>
      </div>

      {day.exercises.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin ejercicios cargados.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {day.exercises.map((exercise, index) => {
            const info = exercise.exerciseId ? exerciseById.get(exercise.exerciseId) : undefined;
            const parts = exercise.detail ? splitDetail(exercise.detail) : [];

            return (
              <li
                key={exercise.id}
                className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/12 text-[10px] font-semibold tabular-nums text-primary"
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Sin ficha no es un botón útil: queda como texto plano, sin
                      cursor ni subrayado que prometan algo que no va a pasar. */}
                  {info ? (
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-primary/90 underline decoration-dotted"
                      onClick={() => onShowExercise(info)}
                    >
                      {exercise.name}
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{exercise.name}</p>
                  )}

                  {parts.length === 1 ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{parts[0]}</p>
                  ) : (
                    parts.length > 1 && (
                      <ul className="mt-1 space-y-0.5">
                        {parts.map((part, partIndex) => (
                          <li
                            key={partIndex}
                            className="flex gap-1.5 text-xs leading-relaxed text-muted"
                          >
                            <span aria-hidden="true" className="text-muted/50">
                              ·
                            </span>
                            <span className="min-w-0">{part}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
