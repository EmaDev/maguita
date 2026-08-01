"use client";

import {
  Card,
  Checkbox,
  PageStatusScreen,
  ProgressBar,
  StreakTracker,
} from "lib-kit-components";
import { FlameIcon } from "@/components/atoms/icons";
import type { Habit } from "@/lib/data/home";
import { habitsToday, streakOf } from "@/lib/home-model";

/**
 * Tab "Hábitos": el check del día, la racha de cada uno y la grilla de
 * constancia de las últimas semanas.
 *
 * El marcado del día es lo único interactivo y lo guarda `HomeBoard` en el
 * dispositivo (todavía no hay endpoint), así que sobrevive a recargas y a
 * cambiar de tab.
 */
interface HabitsPanelProps {
  today: string;
  habits: Habit[];
  onToggle: (habitId: string, done: boolean) => void;
}

export function HabitsPanel({ today, habits, onToggle }: HabitsPanelProps) {
  // Sin hábitos no hay nada que medir: el progreso del día y la grilla de
  // constancia quedarían en cero, que se lee como un error y no como un vacío.
  if (habits.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no hay hábitos"
        description="Cuando sumes uno, acá vas a ver el check del día, la racha y tu constancia."
      />
    );
  }

  const status = habitsToday(habits, today);

  // Un día cuenta para la grilla de constancia si se cumplió al menos un
  // hábito: mide que hubo actividad, no que el día fue perfecto.
  const activeDays = Array.from(new Set(habits.flatMap((habit) => habit.doneDates)));

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Hoy
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {status.done} de {status.total}
            </p>
          </div>

          {status.bestStreak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1.5 text-sm font-medium text-success">
              <FlameIcon className="h-4 w-4" />
              {status.bestStreak} {status.bestStreak === 1 ? "día" : "días"}
            </span>
          )}
        </div>

        <ProgressBar
          className="mt-4"
          value={status.done}
          max={Math.max(status.total, 1)}
          tone={status.done === status.total ? "success" : "primary"}
          size="sm"
        />
      </Card>

      <ul className="space-y-2.5">
        {habits.map((habit) => {
          const done = habit.doneDates.includes(today);
          const streak = streakOf(habit.doneDates, today);

          return (
            <li key={habit.id}>
              <Card variant="glass" padding="sm">
                <Checkbox
                  checked={done}
                  onChange={(next: boolean) => onToggle(habit.id, next)}
                  tone="success"
                  label={<span className={done ? "text-muted line-through" : ""}>{habit.name}</span>}
                  description={
                    <span className="text-xs">
                      Meta: {habit.goalPerWeek} días por semana
                      {streak > 0 && ` · Racha de ${streak} ${streak === 1 ? "día" : "días"}`}
                    </span>
                  }
                />
              </Card>
            </li>
          );
        })}
      </ul>

      <Card variant="glass" padding="md">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Constancia
        </p>
        {/* 12 semanas: en mobile la grilla entra completa sin scroll horizontal. */}
        <StreakTracker
          className="mt-3"
          studiedDates={activeDays}
          weeks={12}
          goalPerWeek={habits.length}
        />
      </Card>
    </div>
  );
}
