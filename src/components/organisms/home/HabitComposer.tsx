"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Button, ChipCarousel, Input, Switch, TimePicker, useSnackbar } from "lib-kit-components";
import { PlusIcon, TrashIcon } from "@/components/atoms/icons";
import { addHabitAction, updateHabitAction } from "@/lib/data/habits-actions";
import type { Habit } from "@/lib/data/home";
import {
  DEFAULT_HABIT_EMOJI,
  DEFAULT_SCHEDULED_WEEKDAYS,
  HABIT_EMOJIS,
  MAX_SUBTITLE_LENGTH,
  TIME_PICKER_UPWARD,
  WEEKDAY_CHIPS,
} from "./habit-options";

/** Mismo tope que `MAX_NAME_LENGTH` en `habits-actions`: el server igual lo valida. */
const MAX_NAME_LENGTH = 60;

/** Mismo tope que `MAX_ACTIONS_PER_HABIT` en `habits-actions`: el server igual lo valida. */
const MAX_ACTIONS_PER_HABIT = 20;

const DEFAULT_ALERT_TIME = "09:00";

interface ActionDraft {
  id: string;
  name: string;
}

interface HabitComposerProps {
  /** Hábito a editar. Ausente = alta de uno nuevo. */
  habit?: Habit;
  /** Lo llama el sheet al guardar bien, para cerrarse. */
  onSaved: () => void;
}

/**
 * Formulario de alta y edición de un hábito, pensado para vivir dentro del
 * `BottomSheet` global (`useAppSheet`). Alta y edición comparten componente
 * porque los campos son exactamente los mismos: sólo cambia contra qué Server
 * Action se guarda y el texto del botón.
 *
 * El emoji se elige de una grilla en vez de un input libre (ver
 * `habit-options`), y los días de un `ChipCarousel` en modo `multi`: la meta
 * semanal ya no se elige como número, sale sola de cuántos días se marcaron.
 * El aviso replica el patrón de `NoteComposer` (`Switch` + `TimePicker`).
 *
 * Los pasos ("Pasos (opcional)") son lo que convierte un hábito simple en uno
 * de grupo: sin ningún toggle explícito — si la lista queda vacía al guardar,
 * es un hábito simple, igual que hoy; con al menos uno, `HabitsPanel` lo
 * muestra como timeline. Sin drag reordering acá (formulario corto en un
 * bottom sheet, no la lista principal): el orden es el orden en que se
 * cargan los pasos.
 */
export function HabitComposer({ habit, onSaved }: HabitComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(habit?.name ?? "");
  const [subtitle, setSubtitle] = useState(habit?.subtitle ?? "");
  const [emoji, setEmoji] = useState<string>(habit?.emoji ?? DEFAULT_HABIT_EMOJI);
  const [scheduledWeekdays, setScheduledWeekdays] = useState<number[]>(
    habit?.scheduledWeekdays ?? DEFAULT_SCHEDULED_WEEKDAYS
  );
  const [alertEnabled, setAlertEnabled] = useState(habit?.alertEnabled ?? false);
  const [alertTime, setAlertTime] = useState(habit?.alertTime ?? DEFAULT_ALERT_TIME);
  const [actions, setActions] = useState<ActionDraft[]>(
    habit?.actions.map(({ id, name: actionName }) => ({ id, name: actionName })) ?? []
  );

  const value = name.trim();
  const valid = !!value && scheduledWeekdays.length > 0 && (!alertEnabled || !!alertTime);

  function addAction() {
    setActions((prev) => [...prev, { id: crypto.randomUUID(), name: "" }]);
  }

  function updateAction(id: string, nextName: string) {
    setActions((prev) => prev.map((action) => (action.id === id ? { ...action, name: nextName } : action)));
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((action) => action.id !== id));
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        // Los pasos sin nombre no se mandan: son filas que el usuario abrió
        // con "Agregar paso" y no llegó a completar.
        const cleanActions = actions
          .map((action) => ({ id: action.id, name: action.name.trim() }))
          .filter((action) => action.name);

        const fields = {
          name: value,
          subtitle: subtitle.trim() || null,
          emoji,
          scheduledWeekdays,
          alertEnabled,
          alertTime: alertEnabled ? alertTime : null,
          actions: cleanActions,
        };
        if (habit) {
          await updateHabitAction({ id: habit.id, ...fields });
        } else {
          await addHabitAction(fields);
        }
        snack({
          message: habit ? "Hábito actualizado." : "Hábito creado.",
          variant: "success",
        });
        onSaved();
      } catch (error) {
        snack({
          message:
            error instanceof Error ? error.message : "No se pudo guardar el hábito.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5 py-1">
      <Input
        label="Nombre"
        placeholder="Ej. Leer 20 minutos"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") save();
        }}
      />

      <Input
        label="Subtítulo (opcional)"
        placeholder="Ej. Antes de dormir"
        value={subtitle}
        maxLength={MAX_SUBTITLE_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSubtitle(e.target.value)}
      />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Emoji
        </p>
        <div className="grid grid-cols-6 gap-2">
          {HABIT_EMOJIS.map((option) => {
            const selected = option === emoji;
            return (
              <motion.button
                key={option}
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() => setEmoji(option)}
                aria-pressed={selected}
                aria-label={`Emoji ${option}`}
                className={`grid aspect-square place-items-center rounded-xl border text-xl transition-colors ${
                  selected
                    ? "border-primary bg-primary/12"
                    : "border-border bg-surface-alt hover:border-primary/40"
                }`}
              >
                {option}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Días de la semana
        </p>
        <ChipCarousel
          chips={WEEKDAY_CHIPS}
          value={scheduledWeekdays.map(String)}
          multi
          size="sm"
          onChange={(next: string | string[]) => {
            /* `multi` está prendido, así que siempre llega un array — el tipo
               de la librería es el mismo para los dos modos. */
            if (Array.isArray(next)) setScheduledWeekdays(next.map(Number));
          }}
        />
        {scheduledWeekdays.length === 0 && (
          <p className="mt-1.5 text-xs text-danger">Elegí al menos un día.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Switch checked={alertEnabled} onChange={setAlertEnabled} label="Avisarme" size="sm" />
      </div>

      {alertEnabled && (
        <TimePicker
          label="Hora del aviso"
          value={alertTime}
          onChange={(value: string | null) => setAlertTime(value ?? DEFAULT_ALERT_TIME)}
          step={5}
          className={TIME_PICKER_UPWARD}
        />
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Pasos (opcional)
        </p>
        <div className="space-y-2">
          {actions.map((action, index) => (
            <div key={action.id} className="flex items-center gap-2">
              <Input
                placeholder={`Paso ${index + 1}`}
                value={action.name}
                maxLength={MAX_NAME_LENGTH}
                disabled={pending}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateAction(action.id, e.target.value)}
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Quitar paso ${index + 1}`}
                onClick={() => removeAction(action.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {actions.length < MAX_ACTIONS_PER_HABIT && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={addAction}>
            <PlusIcon className="h-4 w-4" />
            Agregar paso
          </Button>
        )}
        {actions.length > 0 && (
          <p className="mt-1.5 text-xs text-muted">
            Con al menos un paso, el hábito se muestra como timeline y sólo cuenta el día
            cuando se cumplen todos.
          </p>
        )}
      </div>

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {habit ? "Guardar cambios" : "Crear hábito"}
      </Button>
    </div>
  );
}
