"use client";

import { Button, Card, CardHeader } from "lib-kit-components";
import {
  FlameIcon,
  NoteIcon,
  ReceiptIcon,
  TrendIcon,
} from "@/components/atoms/icons";
import { SummaryCard } from "@/components/molecules/SummaryCard";
import type { Habit, Movement, Note } from "@/lib/data/home";
import {
  formatDay,
  formatMoney,
  formatSignedMoney,
  habitsToday,
  monthBalance,
} from "@/lib/home-model";
import type { HomeTab } from "./tabs";

/**
 * Tab "Resumen": el dashboard de la pantalla. Una card por cada una de las
 * otras tabs, con su último registro, y abajo el detalle de los movimientos
 * más recientes. Ninguna card navega a otra ruta: cambian de tab acá mismo
 * (`onGoTo`), que es lo que hace que el resumen se sienta un índice y no un
 * menú.
 */
interface SummaryPanelProps {
  today: string;
  movements: Movement[];
  notes: Note[];
  habits: Habit[];
  onGoTo: (tab: HomeTab) => void;
}

export function SummaryPanel({
  today,
  movements,
  notes,
  habits,
  onGoTo,
}: SummaryPanelProps) {
  const month = monthBalance(movements, today);
  const habitsStatus = habitsToday(habits, today);
  const lastMovement = movements[0];
  const lastNote = notes[0];
  const recent = movements.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* El degradé es lo que hace que las cards `glass` se lean como vidrio:
          sobre un fondo plano, un fondo semitransparente es indistinguible de
          uno sólido. Decorativo y sin capturar toques. */}
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-56 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-accent/15 to-transparent blur-2xl"
        />

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Balance del mes"
            value={formatMoney(month.balance)}
            tone={month.balance < 0 ? "danger" : "success"}
            icon={<TrendIcon />}
            footnote={`${formatSignedMoney(month.income)} / ${formatMoney(-month.expense)}`}
            onClick={() => onGoTo("movimientos")}
          />

          <SummaryCard
            label="Último movimiento"
            value={lastMovement ? formatSignedMoney(lastMovement.amount) : "Sin movimientos"}
            tone={lastMovement && lastMovement.amount > 0 ? "success" : "primary"}
            icon={<ReceiptIcon />}
            footnote={
              lastMovement
                ? `${lastMovement.title} · ${formatDay(lastMovement.date, today)}`
                : "Cargá el primero desde el botón +."
            }
            onClick={() => onGoTo("movimientos")}
          />

          <SummaryCard
            label="Notas"
            value={
              notes.length === 0
                ? "Sin notas"
                : `${notes.length} ${notes.length === 1 ? "nota" : "notas"}`
            }
            tone="accent"
            icon={<NoteIcon />}
            footnote={lastNote?.text ?? "Anotá algo antes de que se te olvide."}
            onClick={() => onGoTo("notas")}
          />

          <SummaryCard
            label="Hábitos de hoy"
            value={
              habitsStatus.total === 0
                ? "Sin hábitos"
                : `${habitsStatus.done} de ${habitsStatus.total}`
            }
            tone={
              habitsStatus.total > 0 && habitsStatus.done === habitsStatus.total
                ? "success"
                : "primary"
            }
            icon={<FlameIcon />}
            footnote={
              habitsStatus.total === 0
                ? "Todavía no hay hábitos para seguir."
                : habitsStatus.bestStreak > 0
                  ? `Mejor racha: ${habitsStatus.bestStreak} ${habitsStatus.bestStreak === 1 ? "día" : "días"}`
                  : "Empezá una racha hoy."
            }
            onClick={() => onGoTo("habitos")}
          />
        </div>
      </div>

      <Card variant="glass" padding="md">
        <CardHeader
          title="Últimos movimientos"
          subtitle={`${month.count} este mes`}
          aside={
            <Button size="sm" variant="ghost" onClick={() => onGoTo("movimientos")}>
              Ver todos
            </Button>
          }
        />

        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Todavía no cargaste movimientos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recent.map((movement) => (
              <li
                key={movement.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{movement.title}</p>
                  <p className="text-xs text-muted">
                    {movement.category} · {formatDay(movement.date, today)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    movement.amount > 0 ? "text-success" : "text-foreground"
                  }`}
                >
                  {formatSignedMoney(movement.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
