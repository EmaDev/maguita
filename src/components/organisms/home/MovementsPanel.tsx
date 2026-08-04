"use client";

import { Button, Card, CardHeader, ProgressBar } from "lib-kit-components";
import { useAppSheet } from "@/components/shell/app-sheet";
import { PlusIcon, SettingsIcon } from "@/components/atoms/icons";
import type { Movement } from "@/lib/data/home";
import type { ExpenseCycle } from "@/lib/data/expenses";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import { expenseCycleProgress, expenseCycleTitle, formatMoney } from "@/lib/home-model";
import { ExpenseCycleForm } from "./ExpenseCycleForm";
import { ExpenseSettingsSheet } from "./ExpenseSettingsSheet";
import { MovementsList } from "./MovementsList";
import { NewExpenseIncomeSheet } from "./NewExpenseIncomeSheet";
import { NewExpenseMovementSheet } from "./NewExpenseMovementSheet";
import { PastExpenseCyclesSection } from "./PastExpenseCyclesSection";

/**
 * Tab "Movimientos": gestor de gastos por período (versión simplificada de la
 * futura mini-app, misma colección de Firestore). Sin ciclo activo se muestra
 * el alta; con uno, la card de saldo/tope y la lista de sus movimientos.
 */
interface MovementsPanelProps {
  today: string;
  expenseCycle: ExpenseCycle | null;
  cycleMovements: Movement[];
  expenseCategories: ExpenseCategoryItem[];
  pinSet: boolean;
  locked: boolean;
}

export function MovementsPanel({
  today,
  expenseCycle,
  cycleMovements,
  expenseCategories,
  pinSet,
  locked,
}: MovementsPanelProps) {
  const { openSheet, closeSheet } = useAppSheet();

  const openSettingsSheet = () =>
    openSheet(
      <ExpenseSettingsSheet
        categories={expenseCategories}
        cycle={expenseCycle ?? undefined}
        pinSet={pinSet}
        locked={locked}
      />,
      {
        title: "Ajustes",
        description: "Categorías de gasto, y tope y lapso del período en curso.",
      }
    );

  if (!expenseCycle) {
    return (
      <div className="space-y-4">
        <Card variant="glass" padding="md">
          <CardHeader
            title="Armá tu gestor de gastos"
            subtitle="Definí un período con saldo inicial y tope, y después cargá tus gastos día a día."
            aside={
              <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
                <SettingsIcon />
              </Button>
            }
          />
        </Card>
        <ExpenseCycleForm mode="create" />
        <PastExpenseCyclesSection />
      </div>
    );
  }

  const progress = expenseCycleProgress(expenseCycle, cycleMovements, today);

  const openFinishSheet = () =>
    openSheet(<ExpenseCycleForm mode="finish" />, {
      title: "Finalizar período",
      description: "El período actual queda como historial y arranca uno nuevo.",
    });

  const openAddMovementSheet = () =>
    openSheet(
      <NewExpenseMovementSheet
        cycleId={expenseCycle.id}
        date={today}
        categories={expenseCategories}
        onSaved={closeSheet}
      />,
      { title: "Nuevo gasto" }
    );

  const openAddIncomeSheet = () =>
    openSheet(<NewExpenseIncomeSheet cycleId={expenseCycle.id} date={today} />, {
      title: "Nuevo ingreso",
    });

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {expenseCycleTitle(expenseCycle)}
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                progress.remaining < 0 ? "text-danger" : "text-success"
              }`}
            >
              {formatMoney(progress.remaining)}
            </p>
            <p className="text-xs text-muted">Saldo disponible</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={openFinishSheet}>
              Finalizar
            </Button>
            <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
              <SettingsIcon />
            </Button>
          </div>
        </div>

        <ProgressBar
          className="mt-4"
          value={progress.pct}
          tone={progress.over ? "danger" : progress.pct >= 80 ? "accent" : "primary"}
          label={`Gastado ${formatMoney(progress.spent)} de ${formatMoney(expenseCycle.expenseLimit)}`}
          showValue
        />

        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            {progress.ended
              ? "El período ya terminó."
              : progress.daysLeft === 0
                ? "Termina hoy."
                : `${progress.daysLeft} ${progress.daysLeft === 1 ? "día restante" : "días restantes"}`}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="sm"
              variant="secondary"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              disabled={progress.ended}
              onClick={openAddIncomeSheet}
            >
              Ingreso
            </Button>
            <Button
              className="flex-1"
              size="sm"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              disabled={progress.ended}
              onClick={openAddMovementSheet}
            >
              Gasto
            </Button>
          </div>
        </div>
      </Card>

      {cycleMovements.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Todavía no cargaste gastos en este período.
        </p>
      ) : (
        <MovementsList movements={cycleMovements} today={today} />
      )}

      <PastExpenseCyclesSection />
    </div>
  );
}
