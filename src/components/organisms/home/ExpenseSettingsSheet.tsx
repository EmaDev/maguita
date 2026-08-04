"use client";

import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import type { ExpenseCycle } from "@/lib/data/expenses";
import { ExpenseCategoriesEditor } from "./ExpenseCategoriesEditor";
import { ExpenseCycleEditor } from "./ExpenseCycleEditor";

/**
 * Panel de ajustes del gestor de gastos: un solo sheet, abierto con un botón
 * de ajustes en `MovementsPanel`, con las cosas que se pueden tocar sin
 * pasar por "Finalizar" — título/tope/lapso del período en curso, el ABM de
 * categorías y el candado de PinLock. Sin ciclo activo (alta inicial) sólo
 * tiene sentido mostrar las categorías, así que la sección de período es
 * opcional.
 */
interface ExpenseSettingsSheetProps {
  categories: ExpenseCategoryItem[];
  cycle?: ExpenseCycle;
  pinSet: boolean;
  locked: boolean;
}

export function ExpenseSettingsSheet({ categories, cycle, pinSet, locked }: ExpenseSettingsSheetProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Privacidad</p>
        <PinLockSwitch moduleId="movimientos" locked={locked} pinConfigured={pinSet} />
      </section>

      {cycle && (
        <section className="space-y-3 border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Período</p>
          <ExpenseCycleEditor cycle={cycle} />
        </section>
      )}

      <section className="space-y-3 border-t border-border pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Categorías</p>
        <ExpenseCategoriesEditor initialCategories={categories} />
      </section>
    </div>
  );
}
