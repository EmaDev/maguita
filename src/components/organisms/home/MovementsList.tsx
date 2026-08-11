"use client";

import { Card } from "lib-kit-components";
import { TrashIcon } from "@/components/atoms/icons";
import type { Movement } from "@/lib/data/home";
import { formatDay, formatShortDate, formatSignedMoney } from "@/lib/home-model";

/**
 * Lista de movimientos agrupada por día, cada uno en su propia `Card
 * variant="elevated"` (borde + sombra) en vez de filas planas separadas por
 * un divisor — reemplaza a `TransactionList` de `lib-kit-components`, que
 * sólo sabe dibujar filas chatas dentro de una única lista con borde y no
 * expone forma de darle elevación a cada ítem.
 *
 * De paso evita el `dayLabel` interno de `TransactionList` (usa `new
 * Date()` real para "Hoy"/"Ayer", corriendo el riesgo de un mismatch de
 * hidratación si el render del server y el del cliente caen en momentos
 * distintos del día) — acá se agrupa con `formatDay`, que ya recibe `today`
 * resuelto una sola vez en el server.
 */
interface MovementsListProps {
  movements: Movement[];
  /** Referencia para "Hoy"/"Ayer". Sin ella (períodos ya cerrados) usa fecha absoluta. */
  today?: string;
  /**
   * Agrega un botón de borrado por fila. Ausente = lista de sólo lectura, que
   * es como la usa el gestor de gastos de Inicio (un movimiento de un ciclo no
   * se borra); lo usa el detalle de una billetera.
   */
  onDelete?: (movement: Movement) => void;
  /** Deshabilita los botones de borrado mientras hay uno en vuelo. */
  deleting?: boolean;
}

export function MovementsList({ movements, today, onDelete, deleting }: MovementsListProps) {
  const groups = groupByDay(movements, today);

  return (
    <div className="space-y-4">
      {groups.map(([label, items]) => (
        <div key={label}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
          <div className="space-y-2">
            {items.map((movement) => (
              <Card key={movement.id} variant="elevated" padding="sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-base">
                    {movement.categoryEmoji ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{movement.title}</p>
                    <p className="truncate text-[11px] text-muted">{movement.category}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      movement.amount >= 0 ? "text-success" : "text-foreground"
                    }`}
                  >
                    {formatSignedMoney(movement.amount)}
                  </span>
                  {onDelete && (
                    <button
                      type="button"
                      aria-label={`Eliminar ${movement.title}`}
                      disabled={deleting}
                      onClick={() => onDelete(movement)}
                      className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDay(movements: Movement[], today?: string): [string, Movement[]][] {
  const groups: [string, Movement[]][] = [];
  for (const movement of movements) {
    const label = today ? formatDay(movement.date, today) : formatShortDate(movement.date);
    const group = groups.find(([groupLabel]) => groupLabel === label);
    if (group) group[1].push(movement);
    else groups.push([label, [movement]]);
  }
  return groups;
}
