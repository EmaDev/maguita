"use client";

import { useState, useTransition } from "react";
import { Button, DatePicker, Input, useSnackbar, type DateRange } from "lib-kit-components";
import { AmountInput } from "@/components/molecules/AmountInput";
import { useAppSheet } from "@/components/shell/app-sheet";
import { startExpenseCycleAction } from "@/lib/data/expenses-actions";
import { dayKey } from "@/lib/home-model";

/**
 * Alta de un período del gestor de gastos: título, rango de fechas, saldo
 * inicial y tope. Se usa tanto inline (cuando todavía no hay ningún ciclo)
 * como dentro de un sheet (para finalizar uno activo y arrancar otro) — en
 * los dos casos cierra el sheet global al terminar, que es un no-op si no
 * hay uno abierto.
 */
interface ExpenseCycleFormProps {
  mode?: "create" | "finish";
}

export function ExpenseCycleForm({ mode = "create" }: ExpenseCycleFormProps) {
  const { closeSheet } = useAppSheet();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [initialBalance, setInitialBalance] = useState(0);
  const [expenseLimit, setExpenseLimit] = useState(0);

  const valid = !!range.from && !!range.to && initialBalance >= 0 && expenseLimit > 0;

  function save() {
    if (!valid || !range.from || !range.to) return;
    startTransition(async () => {
      await startExpenseCycleAction({
        title,
        startDate: dayKey(range.from!),
        endDate: dayKey(range.to!),
        initialBalance,
        expenseLimit,
      });
      closeSheet();
      snack({
        message: mode === "finish" ? "Nuevo período iniciado." : "Período de gastos creado.",
        variant: "success",
      });
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
        placeholder="Elegí inicio y fin"
        value={range}
        onChange={(value: Date | DateRange | null) => setRange(value as DateRange)}
      />
      <AmountInput
        label="Saldo inicial"
        value={initialBalance}
        onChange={setInitialBalance}
        disabled={pending}
      />
      <AmountInput
        label="Tope de gastos"
        value={expenseLimit}
        onChange={setExpenseLimit}
        disabled={pending}
      />
      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {mode === "finish" ? "Finalizar e iniciar nuevo" : "Iniciar período"}
      </Button>
    </div>
  );
}
