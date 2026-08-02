import { Card, CardHeader, ProgressBar } from "lib-kit-components";
import type { Movement } from "@/lib/data/home";
import type { ExpenseCycle } from "@/lib/data/expenses";
import {
  categoryBreakdown,
  dailyBreakdown,
  expenseCycleTitle,
  formatDateRangeShort,
  formatMoney,
  formatShortDate,
} from "@/lib/home-model";
import { MovementsList } from "./MovementsList";

/**
 * Detalle de un período cerrado (`/inicio/periodos/{cycleId}`): resumen del
 * ciclo, categorías con más gasto, días con más consumo y el listado
 * completo de operaciones. Server Component puro — sin estado propio, así
 * que no hace falta "use client" (`MovementsList` sí lo es, pero un RSC
 * puede montar Client Components sin problema).
 *
 * Las dos "gráficas" son barras de magnitud de un solo color (el listado ya
 * identifica cada fila por su etiqueta/emoji, así que no hace falta un color
 * por categoría) — ver la nota de diseño en el changelog de
 * `docs/firestore-schema.md` para el porqué de esta elección sobre una
 * paleta categórica.
 */
interface PeriodDetailScreenProps {
  cycle: ExpenseCycle;
  movements: Movement[];
}

export function PeriodDetailScreen({ cycle, movements }: PeriodDetailScreenProps) {
  const spent = movements.reduce((total, m) => total + (m.amount < 0 ? -m.amount : 0), 0);
  const income = movements.reduce((total, m) => total + (m.amount > 0 ? m.amount : 0), 0);
  const remaining = cycle.initialBalance + income - spent;
  const pct = cycle.expenseLimit > 0 ? Math.min(100, (spent / cycle.expenseLimit) * 100) : 0;
  const over = spent > cycle.expenseLimit;

  const categories = categoryBreakdown(movements);
  const topCategorySpent = categories[0]?.spent ?? 0;

  const days = dailyBreakdown(movements);
  const topDaySpent = days.reduce((max, day) => Math.max(max, day.spent), 0);
  const peakDay = days.find((day) => day.spent === topDaySpent);

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {formatDateRangeShort(cycle.startDate, cycle.endDate)}
        </p>
        <p className="mt-1 text-xl font-semibold text-foreground">{expenseCycleTitle(cycle)}</p>

        <ProgressBar
          className="mt-4"
          value={pct}
          tone={over ? "danger" : "primary"}
          label={`Gastado ${formatMoney(spent)} de ${formatMoney(cycle.expenseLimit)}`}
          showValue
        />

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <p className="text-[11px] text-muted">Saldo inicial</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(cycle.initialBalance)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Ingresos</p>
            <p className="text-sm font-semibold tabular-nums text-success">{formatMoney(income)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Saldo final</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                remaining < 0 ? "text-danger" : "text-success"
              }`}
            >
              {formatMoney(remaining)}
            </p>
          </div>
        </div>
      </Card>

      {categories.length > 0 && (
        <Card variant="outline" padding="md">
          <CardHeader
            title="Categorías con más gasto"
            subtitle={`${categories.length} ${categories.length === 1 ? "categoría" : "categorías"}`}
          />
          <div className="mt-4 space-y-3">
            {categories.map((item) => (
              <div key={item.category}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground">
                    {item.categoryEmoji && <span>{item.categoryEmoji}</span>}
                    <span className="truncate">{item.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                    {formatMoney(item.spent)}
                  </span>
                </div>
                <ProgressBar
                  value={topCategorySpent > 0 ? (item.spent / topCategorySpent) * 100 : 0}
                  size="sm"
                  tone="primary"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {days.length > 0 && (
        <Card variant="outline" padding="md">
          <CardHeader
            title="Días con más consumo"
            subtitle={
              peakDay
                ? `Máximo: ${formatShortDate(peakDay.date)} · ${formatMoney(peakDay.spent)}`
                : undefined
            }
          />
          <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-1">
            {days.map((day) => {
              const isPeak = day.spent === topDaySpent;
              const height = topDaySpent > 0 ? Math.max(6, (day.spent / topDaySpent) * 64) : 6;
              return (
                <div
                  key={day.date}
                  className="flex shrink-0 flex-col items-center justify-end gap-1"
                  style={{ height: 64 }}
                  title={`${formatShortDate(day.date)} · ${formatMoney(day.spent)}`}
                >
                  <div
                    className={`w-3 rounded-full ${isPeak ? "bg-accent" : "bg-primary/35"}`}
                    style={{ height }}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card variant="outline" padding="md">
        <CardHeader
          title="Todas las operaciones"
          subtitle={`${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}`}
        />
        {movements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Este período no tuvo movimientos.</p>
        ) : (
          <div className="mt-3">
            <MovementsList movements={movements} />
          </div>
        )}
      </Card>
    </div>
  );
}
