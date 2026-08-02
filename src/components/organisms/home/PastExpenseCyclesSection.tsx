"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader, ProgressBar, Skeleton } from "lib-kit-components";
import { ChevronDownIcon } from "@/components/atoms/icons";
import { periodDetailHref } from "@/lib/app-config";
import { getPastExpenseCyclesAction } from "@/lib/data/expenses-actions";
import type { ExpensePeriodSummary } from "@/lib/data/expenses";
import { formatDateRangeShort, formatMoney } from "@/lib/home-model";

/**
 * "Períodos anteriores": un dropdown que, al desplegarse por primera vez,
 * consulta los ciclos `closed` del usuario (`getPastExpenseCyclesAction`) y
 * los muestra como un carrusel horizontal de cards. Es una consulta aparte
 * de `getHomeData()` a propósito — la mayoría de las visitas a Movimientos
 * no llegan a abrir el historial, así que no tiene sentido pagarla siempre.
 *
 * `periods === null` = todavía no se pidió; `[]` = se pidió y no hay
 * ninguno. Una vez cargado queda en estado local, así que volver a
 * cerrar/abrir el dropdown no repite la consulta.
 */
export function PastExpenseCyclesSection() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [periods, setPeriods] = useState<ExpensePeriodSummary[] | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && periods === null) {
      startTransition(async () => {
        setPeriods(await getPastExpenseCyclesAction());
      });
    }
  }

  return (
    <Card variant="outline" padding="none">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-foreground"
      >
        Períodos anteriores
        <ChevronDownIcon
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border p-4">
          {pending ? (
            <div className="flex gap-3">
              {Array.from({ length: 2 }, (_, i) => (
                <Card key={i} variant="outline" padding="md" className="w-52 shrink-0 space-y-3">
                  <Skeleton variant="text" width="70%" height={14} />
                  <Skeleton variant="text" width="45%" height={11} />
                  <Skeleton variant="rounded" height={8} />
                  <Skeleton variant="text" width="80%" height={12} />
                </Card>
              ))}
            </div>
          ) : periods && periods.length > 0 ? (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {periods.map((period) => (
                <PastCycleCard key={period.id} period={period} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-muted">
              Todavía no tenés períodos anteriores.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function PastCycleCard({ period }: { period: ExpensePeriodSummary }) {
  const remaining = period.initialBalance + period.income - period.spent;
  const pct = period.expenseLimit > 0 ? Math.min(100, (period.spent / period.expenseLimit) * 100) : 0;
  const over = period.spent > period.expenseLimit;
  const dateRange = formatDateRangeShort(period.startDate, period.endDate);

  return (
    <Link href={periodDetailHref(period.id)} className="block w-52 shrink-0 snap-start">
      <Card variant="outline" padding="md" interactive className="h-full">
        <CardHeader title={period.title || dateRange} subtitle={period.title ? dateRange : undefined} />

        <ProgressBar
          className="mt-3"
          value={pct}
          tone={over ? "danger" : "primary"}
          size="sm"
        />

        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Gastado</span>
            <span className="font-semibold tabular-nums text-foreground">{formatMoney(period.spent)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Tope</span>
            <span className="tabular-nums text-muted">{formatMoney(period.expenseLimit)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Saldo final</span>
            <span
              className={`font-semibold tabular-nums ${remaining < 0 ? "text-danger" : "text-success"}`}
            >
              {formatMoney(remaining)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
