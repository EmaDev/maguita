"use client";

import { useState, useTransition } from "react";
import { Button, Input, Keypad, useSnackbar } from "lib-kit-components";
import { useAppSheet } from "@/components/shell/app-sheet";
import { addExpenseIncomeAction } from "@/lib/data/expenses-actions";
import { formatMoney } from "@/lib/home-model";

/** Tope de dígitos del monto: mismo límite que usa `AmountPad` de la librería. */
const MAX_DIGITS = 9;

/**
 * Contenido del sheet "Nuevo ingreso": más simple que el de gasto — sin
 * categoría, porque un ingreso (sueldo, transferencia, reposición de saldo)
 * no la necesita. Mismo `Keypad` embebido que `NewExpenseMovementSheet`.
 */
interface NewExpenseIncomeSheetProps {
  cycleId: string;
  date: string;
}

export function NewExpenseIncomeSheet({ cycleId, date }: NewExpenseIncomeSheetProps) {
  const { closeSheet } = useAppSheet();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [rawAmount, setRawAmount] = useState("");
  const [concept, setConcept] = useState("");

  const amount = rawAmount === "" ? 0 : parseInt(rawAmount, 10);
  const valid = amount > 0;

  function pressKey(key: string) {
    if (pending) return;
    if (key === "backspace") {
      setRawAmount((r) => r.slice(0, -1));
      return;
    }
    if (rawAmount.length >= MAX_DIGITS) return;
    setRawAmount((r) => (r === "" && key === "0" ? "" : r + key));
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await addExpenseIncomeAction({ cycleId, title: concept.trim(), amount, date });
        closeSheet();
        snack({ message: "Ingreso cargado al período.", variant: "success" });
        setRawAmount("");
        setConcept("");
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el ingreso.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-alt/60 px-4 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Monto</p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            amount > 0 ? "text-success" : "text-muted"
          }`}
        >
          {formatMoney(amount)}
        </p>
      </div>

      <Keypad
        onKey={pressKey}
        onBackspaceLong={() => setRawAmount("")}
        disabled={pending}
        className="mx-auto max-w-[280px]"
      />

      <Input
        label="Concepto (opcional)"
        value={concept}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConcept(e.target.value)}
        disabled={pending}
      />

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        Guardar ingreso
      </Button>
    </div>
  );
}
