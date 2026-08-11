"use client";

import { useState, useTransition } from "react";
import { Button, Card, useSnackbar } from "lib-kit-components";
import { TrendIcon } from "@/components/atoms/icons";
import { setQuoteAction } from "@/lib/data/wallets-actions";
import { formatShortDate } from "@/lib/home-model";
import {
  ASSET_TYPES,
  CURRENCIES,
  formatAmount,
  formatGainPct,
  formatQuantity,
  formatSignedAmount,
  PRICE_DECIMALS,
  type CurrencyCode,
  type Holding,
} from "@/lib/wallet-model";

/**
 * Tenencias de una cartera: qué tiene hoy, a qué costo promedio, cuánto vale y
 * cuánto lleva ganado o perdido.
 *
 * **Ninguna de estas filas está guardada**: todas salen de recorrer el libro
 * (`portfolio()`), así que cada número de acá se puede seguir hasta las
 * operaciones que lo produjeron. Por eso la lista no tiene editar ni borrar —
 * lo que se corrige es la operación, no la tenencia.
 *
 * Una tenencia sin cotización no muestra 0% —que se leería como "ni ganó ni
 * perdió"— sino el input para cargar el precio ahí mismo (`setQuoteAction`).
 * Ese input es provisorio: es la misma escritura que va a hacer la API de
 * cotizaciones cuando se integre.
 */
interface WalletHoldingsListProps {
  walletId: string;
  holdings: Holding[];
  currency: CurrencyCode;
  /** Milisegundos de la última actualización de cada cotización, por símbolo. */
  quotesUpdatedAt: Record<string, number>;
}

export function WalletHoldingsList({
  walletId,
  holdings,
  currency,
  quotesUpdatedAt,
}: WalletHoldingsListProps) {
  return (
    <div className="space-y-2">
      {holdings.map((holding) => (
        <HoldingRow
          key={holding.assetSymbol}
          walletId={walletId}
          holding={holding}
          currency={currency}
          updatedAt={quotesUpdatedAt[holding.assetSymbol] ?? 0}
        />
      ))}
    </div>
  );
}

function HoldingRow({
  walletId,
  holding,
  currency,
  updatedAt,
}: {
  walletId: string;
  holding: Holding;
  currency: CurrencyCode;
  updatedAt: number;
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [priceDraft, setPriceDraft] = useState("");

  const type = ASSET_TYPES[holding.assetType];

  function savePrice() {
    const price = Number(priceDraft.trim().replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) return;
    startTransition(async () => {
      try {
        await setQuoteAction(walletId, holding.assetSymbol, price);
        setPriceDraft("");
        snack({ message: "Cotización actualizada.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo actualizar la cotización.",
          variant: "error",
        });
      }
    });
  }

  return (
    <Card variant="elevated" padding="sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-base">
          {type.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {holding.assetSymbol}
            <span className="ml-1.5 text-[11px] font-normal text-muted">{type.label}</span>
          </p>
          <p className="truncate text-[11px] text-muted">
            {formatQuantity(holding.quantity)} × costo{" "}
            {formatAmount(holding.avgUnitPrice, currency, PRICE_DECIMALS)} · desde{" "}
            {formatShortDate(holding.firstEntryDate)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-foreground">
            {formatAmount(holding.value, currency, PRICE_DECIMALS)}
          </p>
          {holding.priced ? (
            <p
              className={`text-[11px] font-semibold tabular-nums ${
                holding.unrealizedGain < 0 ? "text-danger" : "text-success"
              }`}
            >
              {formatSignedAmount(holding.unrealizedGain, currency, PRICE_DECIMALS)} (
              {formatGainPct(holding.unrealizedGainPct)})
            </p>
          ) : (
            <p className="text-[11px] text-muted">sin cotización</p>
          )}
        </div>
      </div>

      {holding.realizedGain !== 0 && (
        <p className="mt-1.5 text-[11px] text-muted">
          Ya realizaste{" "}
          <span className={holding.realizedGain < 0 ? "text-danger" : "text-success"}>
            {formatSignedAmount(holding.realizedGain, currency, PRICE_DECIMALS)}
          </span>{" "}
          en ventas de este activo.
        </p>
      )}

      {holding.inconsistent && (
        <p className="mt-1.5 text-[11px] text-danger">
          El libro tiene ventas sin la compra que las respalde. Revisá las operaciones.
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center text-muted">
          <TrendIcon className="h-4 w-4" />
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={priceDraft}
          onChange={(e) => setPriceDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") savePrice();
          }}
          disabled={pending}
          placeholder={
            holding.priced
              ? `Actual: ${formatAmount(holding.currentPrice ?? 0, currency, PRICE_DECIMALS)}`
              : `Cotización en ${CURRENCIES[currency].symbol}`
          }
          aria-label={`Cotización de ${holding.assetSymbol}`}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none tabular-nums placeholder:text-muted focus:border-primary"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || priceDraft.trim() === ""}
          onClick={savePrice}
        >
          Guardar
        </Button>
      </div>

      {updatedAt > 0 && (
        <p className="mt-1 text-right text-[10px] text-muted">
          Cotización del {new Date(updatedAt).toLocaleDateString("es-AR")}
        </p>
      )}
    </Card>
  );
}
