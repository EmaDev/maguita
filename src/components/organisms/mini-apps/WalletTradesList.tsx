"use client";

import { useMemo, useTransition } from "react";
import { Card, useSnackbar } from "lib-kit-components";
import { TrashIcon } from "@/components/atoms/icons";
import type { WalletTrade } from "@/lib/data/wallets";
import { deleteTradeAction } from "@/lib/data/wallets-actions";
import { formatDay } from "@/lib/home-model";
import {
  byTradeOrder,
  formatAmount,
  formatQuantity,
  formatSignedAmount,
  PRICE_DECIMALS,
  TRADE_KINDS,
  type CurrencyCode,
} from "@/lib/wallet-model";

/**
 * El libro de operaciones de una cartera, más reciente primero: el extracto
 * completo de todo lo que pasó adentro.
 *
 * Es la pieza que hace trazable a la cartera. Cada tenencia y cada peso de
 * efectivo que muestra la pantalla sale de estas líneas —no hay ningún total
 * guardado aparte—, así que leer esta lista de arriba a abajo explica
 * exactamente cómo se llegó a los números de arriba.
 *
 * Los asientos no se editan, sólo se borran: un asiento editable dejaría de
 * ser el registro de lo que pasó. Borrar tampoco recalcula nada a mano —el
 * fold vuelve a correr sobre lo que quedó.
 */
interface WalletTradesListProps {
  trades: WalletTrade[];
  currency: CurrencyCode;
  today: string;
}

export function WalletTradesList({ trades, currency, today }: WalletTradesListProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  // Mismo orden que el fold, pero al revés: el libro se lee de lo más nuevo a
  // lo más viejo, aunque se *calcule* de lo más viejo a lo más nuevo.
  const ordered = useMemo(() => [...trades].sort(byTradeOrder).reverse(), [trades]);

  function remove(trade: WalletTrade) {
    startTransition(async () => {
      try {
        await deleteTradeAction(trade.id);
        snack({ message: "Operación eliminada.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar la operación.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      {ordered.map((trade) => {
        const info = TRADE_KINDS[trade.kind];
        return (
          <Card key={trade.id} variant="outline" padding="sm">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-alt text-sm">
                {info.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {info.label}
                  {trade.assetSymbol && (
                    <span className="ml-1.5 text-muted">{trade.assetSymbol}</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {formatDay(trade.date, today)}
                  {trade.quantity !== null && trade.unitPrice !== null && (
                    <>
                      {" · "}
                      {formatQuantity(trade.quantity)} ×{" "}
                      {formatAmount(trade.unitPrice, currency, PRICE_DECIMALS)}
                    </>
                  )}
                </p>
              </div>

              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  trade.cashAmount >= 0 ? "text-success" : "text-foreground"
                }`}
              >
                {formatSignedAmount(trade.cashAmount, currency, PRICE_DECIMALS)}
              </span>

              <button
                type="button"
                aria-label={`Eliminar ${info.label.toLowerCase()} del ${trade.date}`}
                disabled={pending}
                onClick={() => remove(trade)}
                className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            {trade.note && <p className="mt-1.5 pl-11 text-[11px] text-muted">{trade.note}</p>}
          </Card>
        );
      })}
    </div>
  );
}
