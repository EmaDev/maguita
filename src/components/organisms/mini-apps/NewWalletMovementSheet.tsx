"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, ChipCarousel, Input, Keypad, useSnackbar, type Chip } from "lib-kit-components";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import { addWalletMovementAction } from "@/lib/data/wallets-actions";
import { formatAmount, type CurrencyCode } from "@/lib/wallet-model";

/** Tope de dígitos del monto: mismo límite que `NewExpenseMovementSheet`. */
const MAX_DIGITS = 9;

/**
 * Alta de un movimiento de billetera. Es el equivalente de
 * `NewExpenseMovementSheet`/`NewExpenseIncomeSheet` del gestor de gastos, pero
 * **uno solo para las dos operaciones**: acá gasto e ingreso escriben el mismo
 * documento (ver `addWalletMovementAction`), así que la única diferencia de
 * pantalla es que el ingreso no pide categoría.
 *
 * Igual que el del gestor de gastos, el monto se carga con un `Keypad` adentro
 * del sheet: los pesos son siempre enteros, así que alcanza con acumular
 * dígitos, sin tecla de coma.
 */
interface NewWalletMovementSheetProps {
  walletId: string;
  walletName: string;
  /** Moneda de la billetera: es la unidad del monto que se está cargando. */
  currency: CurrencyCode;
  date: string;
  kind: "expense" | "income";
  /** ABM de categorías del usuario — el mismo que usa el gestor de gastos. Vacío para un ingreso. */
  categories: ExpenseCategoryItem[];
  onSaved?: () => void;
}

export function NewWalletMovementSheet({
  walletId,
  walletName,
  currency,
  date,
  kind,
  categories,
  onSaved,
}: NewWalletMovementSheetProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [rawAmount, setRawAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [concept, setConcept] = useState("");

  const isExpense = kind === "expense";

  const chips = useMemo<Chip[]>(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: `${category.emoji} ${category.name}`,
      })),
    [categories]
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const amount = rawAmount === "" ? 0 : parseInt(rawAmount, 10);
  const valid = amount > 0 && (!isExpense || !!selectedCategory);

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
        await addWalletMovementAction({
          walletId,
          title: concept.trim() || selectedCategory?.name || "",
          amount,
          date,
          categoryId: selectedCategory?.id,
          kind,
        });
        snack({
          message: isExpense ? "Gasto cargado a la billetera." : "Ingreso cargado a la billetera.",
          variant: "success",
        });
        setRawAmount("");
        setConcept("");
        onSaved?.();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el movimiento.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-alt/60 px-4 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {isExpense ? "Gasto en" : "Ingreso a"} {walletName}
        </p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            amount > 0 ? (isExpense ? "text-foreground" : "text-success") : "text-muted"
          }`}
        >
          {formatAmount(amount, currency)}
        </p>
      </div>

      <Keypad
        onKey={pressKey}
        onBackspaceLong={() => setRawAmount("")}
        disabled={pending}
        className="mx-auto max-w-[280px]"
      />

      {isExpense && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Categoría</p>
          {chips.length === 0 ? (
            <p className="text-xs text-muted">
              Todavía no armaste ninguna categoría. Creá una desde “Ajustes” en Movimientos.
            </p>
          ) : (
            <ChipCarousel
              chips={chips}
              value={categoryId}
              onChange={(value: string | string[]) => setCategoryId(value as string)}
              clearable={false}
            />
          )}
        </div>
      )}

      <Input
        label="Concepto (opcional)"
        value={concept}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConcept(e.target.value)}
        disabled={pending}
      />

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {isExpense ? "Guardar gasto" : "Guardar ingreso"}
      </Button>
    </div>
  );
}
