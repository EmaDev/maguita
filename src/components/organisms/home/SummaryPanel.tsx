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
import type { ExpenseCycle } from "@/lib/data/expenses";
import type { WalletShortcuts } from "@/lib/data/wallets";
import {
  expenseCycleProgress,
  formatDay,
  formatMoney,
  formatSignedMoney,
  habitsToday,
} from "@/lib/home-model";
import { HomeWalletsCarousel } from "./HomeWalletsCarousel";
import { MovementsList } from "./MovementsList";
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
  expenseCycle: ExpenseCycle | null;
  notes: Note[];
  habits: Habit[];
  /** Accesos directos a billeteras de la mini-app Billetera (ver `HomeWalletsCarousel`). */
  walletShortcuts: WalletShortcuts;
  onGoTo: (tab: HomeTab) => void;
}

export function SummaryPanel({
  today,
  movements,
  expenseCycle,
  notes,
  habits,
  walletShortcuts,
  onGoTo,
}: SummaryPanelProps) {
  // `movements` ya son sólo los del ciclo activo del gestor de gastos (ver
  // `getHomeData`), así que el balance tiene que salir de la misma cuenta que
  // usa Movimientos (`expenseCycleProgress`: saldo inicial + ingresos −
  // gastos). Filtrar además por "mes calendario" (como hacía la vieja
  // `monthBalance`) estaba mal: el período de un ciclo no tiene por qué
  // coincidir con un mes, así que esa cuenta se comía movimientos del ciclo o
  // ignoraba el saldo inicial, mostrando un número distinto al de Movimientos
  // para lo que es el mismo saldo.
  const progress = expenseCycle ? expenseCycleProgress(expenseCycle, movements, today) : null;
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
            label="Saldo disponible"
            value={progress ? formatMoney(progress.remaining) : "Sin período activo"}
            tone={progress ? (progress.remaining < 0 ? "danger" : "success") : "primary"}
            icon={<TrendIcon />}
            footnote={
              progress
                ? `${formatSignedMoney(progress.income)} / ${formatMoney(-progress.spent)}`
                : "Armá tu gestor de gastos en Movimientos."
            }
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

      <HomeWalletsCarousel shortcuts={walletShortcuts} />

      <Card variant="glass" padding="md">
        <CardHeader
          title="Últimos movimientos"
          subtitle={`${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"} en el período`}
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
          <div className="mt-3">
            <MovementsList movements={recent} today={today} />
          </div>
        )}
      </Card>
    </div>
  );
}
