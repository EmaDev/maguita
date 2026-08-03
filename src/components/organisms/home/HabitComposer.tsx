"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Button, ChipCarousel, Input, useSnackbar } from "lib-kit-components";
import { addHabitAction, updateHabitAction } from "@/lib/data/habits-actions";
import type { Habit } from "@/lib/data/home";
import {
  DEFAULT_GOAL_PER_WEEK,
  DEFAULT_HABIT_EMOJI,
  GOAL_CHIPS,
  HABIT_EMOJIS,
} from "./habit-options";

/** Mismo tope que `MAX_NAME_LENGTH` en `habits-actions`: el server igual lo valida. */
const MAX_NAME_LENGTH = 60;

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
 * `habit-options`), y la meta semanal de un `ChipCarousel` con `clearable` en
 * `false`: siempre tiene que haber una meta elegida, deseleccionarla dejaría
 * el formulario en un estado que el server rechaza.
 */
export function HabitComposer({ habit, onSaved }: HabitComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState<string>(habit?.emoji ?? DEFAULT_HABIT_EMOJI);
  const [goalPerWeek, setGoalPerWeek] = useState(habit?.goalPerWeek ?? DEFAULT_GOAL_PER_WEEK);

  const value = name.trim();

  function save() {
    if (!value) return;
    startTransition(async () => {
      try {
        if (habit) {
          await updateHabitAction({ id: habit.id, name: value, emoji, goalPerWeek });
        } else {
          await addHabitAction({ name: value, emoji, goalPerWeek });
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
          Meta semanal
        </p>
        <ChipCarousel
          chips={GOAL_CHIPS}
          value={String(goalPerWeek)}
          clearable={false}
          size="sm"
          onChange={(next: string | string[]) => {
            /* `multi` está apagado, así que siempre llega un string — el tipo
               de la librería es el mismo para los dos modos. */
            if (typeof next === "string") setGoalPerWeek(Number(next));
          }}
        />
      </div>

      <Button fullWidth onClick={save} disabled={!value} loading={pending}>
        {habit ? "Guardar cambios" : "Crear hábito"}
      </Button>
    </div>
  );
}
