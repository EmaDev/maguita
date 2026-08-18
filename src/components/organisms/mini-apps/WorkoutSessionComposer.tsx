"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import {
  Button,
  DatePicker,
  Input,
  Textarea,
  useSnackbar,
  type DateRange,
} from "lib-kit-components";
import { TrashIcon } from "@/components/atoms/icons";
import { deleteWorkoutAction, logWorkoutAction } from "@/lib/data/workouts-actions";
import type { WorkoutRoutine, WorkoutSession } from "@/lib/data/workouts";
import { dayKey, formatDay, parseDay } from "@/lib/home-model";
import { routineDayFor } from "@/lib/workout-model";

/** Mismos topes que `workouts-actions.ts`: el server igual los valida. */
const MAX_TITLE_LENGTH = 60;
const MAX_NOTE_LENGTH = 600;

interface WorkoutSessionComposerProps {
  /** Día que se registra, `yyyy-mm-dd`. */
  date: string;
  /** Hoy según el server, para el "Hoy"/"Ayer" del encabezado y el tope del calendario. */
  today: string;
  /** Registro existente de ese día. Ausente = se está marcando por primera vez. */
  session?: WorkoutSession;
  /** Rutina activa, para proponer el título del día y guardar con qué se entrenó. */
  activeRoutine: WorkoutRoutine | null;
  /**
   * Muestra el calendario para elegir qué día se registra. Se usa al cargar
   * un día atrasado; al marcar hoy o editar un día ya registrado la fecha es
   * fija (cambiarla ahí movería el registro de lugar en vez de crear uno).
   */
  pickDate?: boolean;
  /** Registros existentes por día, para avisar si el día elegido ya está marcado. */
  sessionByDate?: Map<string, WorkoutSession>;
  /** Lo llama el sheet al guardar o borrar, para cerrarse. */
  onSaved: () => void;
  /** Se dispara al registrar un día que no estaba marcado (para el confeti). */
  onLogged?: () => void;
}

/**
 * Registro de un día entrenado: qué se hizo y la nota del día. Alta y edición
 * son el mismo formulario porque son la misma escritura — el id del documento
 * se deriva del día, así que guardar de nuevo pisa el registro anterior (ver
 * `logWorkoutAction`).
 *
 * El título arranca con lo que la rutina activa programa para ese día, pero
 * es editable: el usuario puede haber cambiado el orden, o entrenado algo
 * distinto de lo planificado.
 */
export function WorkoutSessionComposer({
  date,
  today,
  session,
  activeRoutine,
  pickDate = false,
  sessionByDate,
  onSaved,
  onLogged,
}: WorkoutSessionComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [day, setDay] = useState(date);
  const plan = routineDayFor(activeRoutine, day);
  /* Con el calendario abierto el día cambia, así que el registro existente y
     lo que la rutina programa se resuelven contra el día elegido, no contra
     el que abrió el sheet. */
  const existing = sessionByDate?.get(day) ?? (day === date ? session : undefined);

  const [title, setTitle] = useState(session?.title ?? plan?.title ?? "");
  const [note, setNote] = useState(session?.note ?? "");

  const valid = !!title.trim();

  /**
   * Al mover el calendario se rellenan título y nota con lo que corresponda
   * al día nuevo — el registro que ya tenga, o lo que la rutina programe —
   * pero **sólo si el usuario no escribió nada propio todavía**: pisarle un
   * texto ya tipeado por cambiar de fecha sería peor que dejarlo como está.
   */
  function changeDay(next: string) {
    const nextSession = sessionByDate?.get(next);
    const nextPlan = routineDayFor(activeRoutine, next);
    const untouched = !title.trim() || title === (existing?.title ?? plan?.title ?? "");
    if (untouched) setTitle(nextSession?.title ?? nextPlan?.title ?? "");
    if (!note.trim()) setNote(nextSession?.note ?? "");
    setDay(next);
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await logWorkoutAction({
          date: day,
          title: title.trim(),
          note: note.trim() || null,
          /* Un día ya registrado conserva la rutina con la que se marcó; uno
             nuevo se atribuye a la activa (o a ninguna, si no hay). */
          routineId: existing?.routineId ?? activeRoutine?.id ?? null,
        });
        snack({
          message: existing ? "Registro actualizado." : "¡Entrenamiento registrado!",
          variant: "success",
        });
        if (!existing) onLogged?.();
        onSaved();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el registro.",
          variant: "error",
        });
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteWorkoutAction(day);
        snack({ message: "Día desmarcado.", variant: "success" });
        onSaved();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo desmarcar el día.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4 py-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {formatDay(day, today)}
        {plan && ` · Programado: ${plan.title}`}
      </p>

      {pickDate && (
        <DatePicker
          mode="single"
          label="Día"
          // No se puede registrar un entrenamiento en el futuro: la racha se
          // mide contra días que ya pasaron.
          max={parseDay(today)}
          value={parseDay(day)}
          onChange={(value: Date | DateRange | null) => {
            if (value instanceof Date) changeDay(dayKey(value));
          }}
        />
      )}

      {pickDate && existing && (
        <p className="text-xs text-danger">
          Ese día ya estaba registrado: guardar reemplaza lo que tenía.
        </p>
      )}

      <Input
        label="Qué entrenaste"
        placeholder="Ej. Pecho y tríceps"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
      />

      <Textarea
        label="Nota del día (opcional)"
        placeholder="Cómo te fue, pesos, sensaciones…"
        value={note}
        rows={4}
        maxLength={MAX_NOTE_LENGTH}
        showCount
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
      />

      {plan && plan.exercises.length > 0 && (
        <div className="rounded-2xl border border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Lo que toca hoy
          </p>
          <ul className="mt-2 space-y-2">
            {plan.exercises.map((exercise) => (
              /* Mismo envoltorio que `WorkoutRoutineCard` y por el mismo
                 motivo: el detalle puede ser el bloque completo del día. */
              <li
                key={exercise.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="min-w-0">{exercise.name}</span>
                {exercise.detail && (
                  <span className="min-w-0 text-muted">{exercise.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
          {existing ? "Guardar cambios" : "Registrar"}
        </Button>
        {existing && (
          <Button
            size="icon"
            variant="outline"
            aria-label="Desmarcar el día"
            disabled={pending}
            onClick={remove}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
