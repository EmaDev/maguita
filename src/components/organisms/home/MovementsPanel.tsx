"use client";

import { useMemo } from "react";
import {
  Card,
  PageStatusScreen,
  TransactionList,
  type Transaction,
} from "lib-kit-components";
import type { Movement } from "@/lib/data/home";
import { formatMoney, formatSignedMoney, monthBalance, parseDay } from "@/lib/home-model";

/**
 * Tab "Movimientos": balance del mes arriba y el historial completo abajo,
 * agrupado por día y filtrable por categoría (eso lo resuelve entero
 * `TransactionList`).
 */
interface MovementsPanelProps {
  today: string;
  movements: Movement[];
  onAdd: () => void;
}

export function MovementsPanel({ today, movements, onAdd }: MovementsPanelProps) {
  const month = monthBalance(movements, today);

  // `TransactionList` pide `Date`. Las fechas nuestras son días sin hora, así
  // que las llevamos al mediodía local (`parseDay`) para que ningún huso las
  // corra al día anterior.
  const transactions = useMemo<Transaction[]>(
    () =>
      movements.map((movement) => ({
        id: movement.id,
        date: parseDay(movement.date),
        title: movement.title,
        category: movement.category,
        amount: movement.amount,
      })),
    [movements]
  );

  if (movements.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no hay movimientos"
        description="Cargá un gasto y acá vas a ver el detalle mes a mes."
        primary={{ label: "Cargar un gasto", onClick: onAdd }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Balance del mes
        </p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            month.balance < 0 ? "text-danger" : "text-success"
          }`}
        >
          {formatMoney(month.balance)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-xs text-muted">Ingresos</p>
            <p className="text-sm font-semibold text-success tabular-nums">
              {formatSignedMoney(month.income)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Gastos</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatMoney(-month.expense)}
            </p>
          </div>
        </div>
      </Card>

      <TransactionList transactions={transactions} currency="ARS" locale="es-AR" />
    </div>
  );
}
