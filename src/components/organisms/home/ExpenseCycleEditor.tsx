"use client";

import { useState, useTransition } from "react";
import { Button, DatePicker, Input, useSnackbar, type DateRange } from "lib-kit-components";
import { AmountInput } from "@/components/molecules/AmountInput";
import { updateExpenseCycleAction } from "@/lib/data/expenses-actions";
import type { ExpenseCycle } from "@/lib/data/expenses";
import { dayKey, parseDay } from "@/lib/home-model";

/**
 * Sección "Período" del panel de ajustes del gestor de gastos: título, tope
 * de gastos y lapso de fechas de un ciclo ya en curso, sin cerrarlo (a
 * diferencia de "Finalizar", que arranca uno nuevo). El saldo inicial no se
 * puede tocar acá — ver la nota en `updateExpenseCycleAction`.
 *
 * No cierra el sheet contenedor al guardar: vive junto a la sección de
 * categorías dentro de `ExpenseSettingsSheet`, así que cerrarlo de golpe
 * cortaría de raíz si el usuario todavía quería tocar algo más ahí abajo.
 */
interface ExpenseCycleEditorProps {
  cycle: ExpenseCycle;
}

export function ExpenseCycleEditor({ cycle }: ExpenseCycleEditorProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(cycle.title ?? "");
  const [range, setRange] = useState<DateRange>({
    from: parseDay(cycle.startDate),
    to: parseDay(cycle.endDate),
  });
  const [expenseLimit, setExpenseLimit] = useState(cycle.expenseLimit);

  const valid = !!range.from && !!range.to && expenseLimit > 0;

  function save() {
    if (!valid || !range.from || !range.to) return;
    startTransition(async () => {
      await updateExpenseCycleAction({
        cycleId: cycle.id,
        title,
        startDate: dayKey(range.from!),
        endDate: dayKey(range.to!),
        expenseLimit,
      });
      snack({ message: "Período actualizado.", variant: "success" });
    });
  }

  return (
    <div className="space-y-3">
      <Input
        label="Título (opcional)"
        placeholder="Ej. Gastos vacaciones Ushuaia"
        value={title}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        disabled={pending}
      />
      <DatePicker
        mode="range"
        label="Período"
        value={range}
        onChange={(value: Date | DateRange | null) => setRange(value as DateRange)}
      />
      <AmountInput
        label="Tope de gastos"
        value={expenseLimit}
        onChange={setExpenseLimit}
        disabled={pending}
      />
      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        Guardar cambios
      </Button>
    </div>
  );
}
