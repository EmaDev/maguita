"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, ChipCarousel, Input, Keypad, useSnackbar, type Chip } from "lib-kit-components";
import { addExpenseMovementAction } from "@/lib/data/expenses-actions";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import { formatMoney } from "@/lib/home-model";

/** Tope de dígitos del monto: mismo límite que usa `AmountPad` de la librería. */
const MAX_DIGITS = 9;

/**
 * Contenido del sheet "Nuevo gasto" del gestor de gastos. Recibe `cycleId`,
 * `date` y `categories` como props (resueltos por el caller a partir de los
 * datos del server) en vez de pedirlos al montarse.
 *
 * Se monta en dos lugares con mecanismos de sheet distintos: el propio de
 * `MovementsPanel` (`useAppSheet()`, con `closeSheet()`) y el `FabActionSheets`
 * del FAB de Inicio, que no expone ninguna forma de cerrarse desde adentro de
 * su `content`. Por eso no depende de `useAppSheet()` acá — `onSaved` es
 * opcional y cada caller decide qué hacer al guardar (cerrar su sheet, o
 * nada).
 *
 * El monto se carga con un `Keypad` directo adentro del sheet (no con
 * `AmountPad`, que es un overlay a pantalla completa aparte): los pesos acá
 * son siempre enteros (ver `Movement.amount`), así que alcanza con acumular
 * dígitos, sin tecla de coma.
 */
interface NewExpenseMovementSheetProps {
  cycleId: string;
  date: string;
  categories: ExpenseCategoryItem[];
  onSaved?: () => void;
}

export function NewExpenseMovementSheet({
  cycleId,
  date,
  categories,
  onSaved,
}: NewExpenseMovementSheetProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [rawAmount, setRawAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [concept, setConcept] = useState("");

  const chips = useMemo<Chip[]>(
    () => categories.map((category) => ({ id: category.id, label: `${category.emoji} ${category.name}` })),
    [categories]
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const amount = rawAmount === "" ? 0 : parseInt(rawAmount, 10);
  const valid = amount > 0 && !!selectedCategory;

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
    if (!valid || !selectedCategory) return;
    startTransition(async () => {
      // Sin este catch, cualquier rechazo (categoría borrada entre que se
      // abrió el sheet y se guardó, el período recién finalizado, etc.) se
      // perdía en silencio: ni el snack de éxito ni `onSaved()` corrían, y
      // tampoco había un snack de error — el sheet se quedaba ahí sin dar
      // ninguna pista de que el gasto no se guardó.
      try {
        await addExpenseMovementAction({
          cycleId,
          title: concept.trim() || selectedCategory.name,
          categoryId: selectedCategory.id,
          amount,
          date,
        });
        snack({ message: "Gasto cargado al período.", variant: "success" });
        setRawAmount("");
        setCategoryId(categories[0]?.id ?? "");
        setConcept("");
        onSaved?.();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el gasto.",
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
            amount > 0 ? "text-foreground" : "text-muted"
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

      <Input
        label="Concepto (opcional)"
        value={concept}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConcept(e.target.value)}
        disabled={pending}
      />

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        Guardar gasto
      </Button>
    </div>
  );
}
