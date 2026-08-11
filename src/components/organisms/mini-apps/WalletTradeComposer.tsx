"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { Button, DatePicker, Input, Select, useSnackbar, type DateRange } from "lib-kit-components";
import { useAppSheet } from "@/components/shell/app-sheet";
import type { WalletTrade } from "@/lib/data/wallets";
import { recordTradeAction } from "@/lib/data/wallets-actions";
import { dayKey, parseDay } from "@/lib/home-model";
import {
  ASSET_NAME_MAX,
  ASSET_SYMBOL_MAX,
  ASSET_TYPE_IDS,
  ASSET_TYPES,
  CURRENCIES,
  DEFAULT_ASSET_TYPE,
  formatAmount,
  formatQuantity,
  portfolio,
  PRICE_DECIMALS,
  TRADE_KINDS,
  TRADE_NOTE_MAX,
  type AssetType,
  type CurrencyCode,
  type Holding,
  type TradeKind,
} from "@/lib/wallet-model";

/**
 * Alta de una operación del libro de una cartera. Un solo composer para las
 * seis (depósito, retiro, compra, venta, dividendo, comisión): lo que cambia
 * entre ellas es qué campos pide, y eso lo dice el registro `TRADE_KINDS`.
 *
 * La **venta** es el caso con más ayuda: el activo no se tipea, se elige de las
 * tenencias que la cartera realmente tiene, con su cantidad disponible, un
 * atajo "Todo" y la vista previa de qué resultado va a realizar y cuánto
 * efectivo va a quedar sin invertir. La misma tenencia que se muestra acá es
 * la que valida el server (`heldQuantity`, sobre el mismo `portfolio()`), así
 * que nunca ofrece vender algo que después va a rebotar.
 *
 * Los montos van con un `Input` numérico y no con `AmountInput`: ése formatea
 * con separador de miles y **redondea a entero**, correcto para los pesos del
 * resto de la app pero destructivo para 0.0031 BTC o un precio de 12,45.
 */
interface WalletTradeComposerProps {
  walletId: string;
  currency: CurrencyCode;
  /** Día de hoy resuelto en el server, default de la fecha de la operación. */
  today: string;
  kind: TradeKind;
  /** El libro completo de la cartera: de acá salen las tenencias que se pueden vender. */
  trades: WalletTrade[];
  /** Cotizaciones cargadas, para proponer un precio de venta razonable. */
  quotes: Record<string, number>;
  /** Efectivo disponible, para avisar si una compra lo deja en rojo. */
  cash: number;
  onSaved?: () => void;
}

export function WalletTradeComposer({
  walletId,
  currency,
  today,
  kind,
  trades,
  quotes,
  cash,
  onSaved,
}: WalletTradeComposerProps) {
  const { closeSheet } = useAppSheet();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const info = TRADE_KINDS[kind];
  const holdings = useMemo(() => portfolio(trades, quotes).holdings, [trades, quotes]);
  const isSale = kind === "venta";
  const isPurchase = kind === "compra";
  /**
   * Un dividendo no mueve tenencia (`movesAsset: false`) pero **sí** dice de
   * qué activo vino: sin eso el libro tendría plata entrando sin explicar por
   * qué. Por eso pide símbolo aunque no pida cantidad ni precio, y el server
   * lo exige igual (ver `recordTradeAction`).
   */
  const needsAsset = info.movesAsset || kind === "dividendo";

  const [holdingSymbol, setHoldingSymbol] = useState(holdings[0]?.assetSymbol ?? "");
  const selected: Holding | undefined = holdings.find(
    (holding) => holding.assetSymbol === holdingSymbol
  );

  const [assetSymbol, setAssetSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>(DEFAULT_ASSET_TYPE);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(() =>
    isSale && holdings[0]?.currentPrice ? String(holdings[0].currentPrice) : ""
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  const quantityValue = toNumber(quantity);
  const priceValue = toNumber(unitPrice);
  const amountValue = toNumber(amount);

  // En compra/venta el importe se deriva del precio × cantidad, salvo que el
  // usuario lo pise para meter la comisión del broker en la misma operación.
  const effectiveAmount = info.movesAsset
    ? amountValue > 0
      ? amountValue
      : quantityValue * priceValue
    : amountValue;

  const symbol = isSale ? (selected?.assetSymbol ?? "") : assetSymbol.trim().toUpperCase();
  const available = selected?.quantity ?? 0;
  const overSells = isSale && quantityValue > available + 1e-9;

  const valid = info.movesAsset
    ? symbol.length > 0 && quantityValue > 0 && priceValue > 0 && !overSells
    : amountValue > 0 && (!needsAsset || symbol.length > 0);

  /** Lo que la operación va a dejar en el efectivo de la cartera. */
  const cashAfter = valid ? cash + effectiveAmount * info.cashSign : cash;

  /** Resultado que realiza una venta: lo que entra menos lo que costó lo vendido. */
  const realized =
    isSale && selected && valid ? effectiveAmount - selected.avgUnitPrice * quantityValue : null;

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await recordTradeAction({
          walletId,
          kind,
          date,
          assetSymbol: needsAsset ? symbol : undefined,
          assetName: isSale ? selected?.assetName : assetName,
          assetType: isSale ? selected?.assetType : assetType,
          quantity: info.movesAsset ? quantityValue : undefined,
          unitPrice: info.movesAsset ? priceValue : undefined,
          amount: info.movesAsset ? (amountValue > 0 ? amountValue : undefined) : amountValue,
          note,
        });
        snack({ message: `${info.label} registrado.`, variant: "success" });
        closeSheet();
        onSaved?.();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo registrar la operación.",
          variant: "error",
        });
      }
    });
  }

  if (isSale && holdings.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Todavía no tenés nada para vender en esta cartera.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {isSale ? (
        <>
          <Select
            label="Activo"
            value={holdingSymbol}
            onChange={(value: string) => {
              setHoldingSymbol(value);
              // Al cambiar de activo se propone su última cotización como
              // precio de venta: es el número que el usuario tiene a mano.
              const next = holdings.find((holding) => holding.assetSymbol === value);
              setUnitPrice(next?.currentPrice ? String(next.currentPrice) : "");
              setQuantity("");
            }}
            options={holdings.map((holding) => ({
              value: holding.assetSymbol,
              label: `${ASSET_TYPES[holding.assetType].emoji} ${holding.assetSymbol} · ${formatQuantity(holding.quantity)}`,
            }))}
          />
          {selected && (
            <p className="text-xs text-muted">
              Tenés <span className="font-semibold text-foreground">{formatQuantity(available)}</span>{" "}
              unidades, a un costo promedio de{" "}
              {formatAmount(selected.avgUnitPrice, currency, PRICE_DECIMALS)}.
            </p>
          )}
        </>
      ) : (
        needsAsset && (
          <>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                label="Símbolo"
                placeholder="AAPL, BTC, GGAL…"
                value={assetSymbol}
                maxLength={ASSET_SYMBOL_MAX}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAssetSymbol(e.target.value)}
                disabled={pending}
                hint="Con esto se va a buscar la cotización."
              />
              <Select
                className="flex-1"
                label="Tipo"
                value={assetType}
                onChange={(value: string) => setAssetType(value as AssetType)}
                options={ASSET_TYPE_IDS.map((id) => ({
                  value: id,
                  label: `${ASSET_TYPES[id].emoji} ${ASSET_TYPES[id].label}`,
                }))}
              />
            </div>
            <Input
              label="Nombre (opcional)"
              placeholder="Ej. Apple Inc."
              value={assetName}
              maxLength={ASSET_NAME_MAX}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAssetName(e.target.value)}
              disabled={pending}
            />
          </>
        )
      )}

      <DatePicker
        mode="single"
        label="Fecha"
        placeholder="Cuándo fue"
        value={parseDay(date)}
        onChange={(value: Date | DateRange | null) => {
          if (value instanceof Date) setDate(dayKey(value));
        }}
        max={parseDay(today)}
      />

      {info.movesAsset ? (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Cantidad"
                inputMode="decimal"
                placeholder="0"
                value={quantity}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                disabled={pending}
                error={overSells ? "Más de lo que tenés" : undefined}
              />
              {isSale && selected && (
                <button
                  type="button"
                  onClick={() => setQuantity(String(available))}
                  className="mt-1 text-[11px] font-semibold text-primary"
                >
                  Vender todo ({formatQuantity(available)})
                </button>
              )}
            </div>
            <Input
              className="flex-1"
              label={`Precio unitario (${CURRENCIES[currency].symbol})`}
              inputMode="decimal"
              placeholder="0"
              value={unitPrice}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUnitPrice(e.target.value)}
              disabled={pending}
            />
          </div>

          <Input
            label={`Importe total (${CURRENCIES[currency].symbol}, opcional)`}
            inputMode="decimal"
            placeholder={
              quantityValue > 0 && priceValue > 0
                ? formatAmount(quantityValue * priceValue, currency, PRICE_DECIMALS)
                : "0"
            }
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            disabled={pending}
            hint="Sólo si el importe real difiere (comisiones, redondeos)."
          />
        </>
      ) : (
        <Input
          label={`Importe (${CURRENCIES[currency].symbol})`}
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          disabled={pending}
        />
      )}

      <Input
        label="Nota (opcional)"
        value={note}
        maxLength={TRADE_NOTE_MAX}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
        disabled={pending}
      />

      {valid && (
        <div className="space-y-1 rounded-2xl border border-border bg-surface-alt/60 px-4 py-3 text-xs">
          <Row
            label={info.cashSign > 0 ? "Entra a la cartera" : "Sale de la cartera"}
            value={formatAmount(effectiveAmount, currency, PRICE_DECIMALS)}
          />
          {realized !== null && (
            <Row
              label="Resultado que realizás"
              value={formatAmount(realized, currency, PRICE_DECIMALS)}
              tone={realized < 0 ? "danger" : "success"}
            />
          )}
          <Row
            label="Efectivo sin invertir después"
            value={formatAmount(cashAfter, currency, PRICE_DECIMALS)}
            tone={cashAfter < 0 ? "danger" : undefined}
          />
          {/* No bloquea la carga: alguien puede estar cargando su historial
              fuera de orden, y trabar la compra por eso sería peor. Se avisa
              y listo — el efectivo negativo queda visible en la cartera. */}
          {isPurchase && cashAfter < 0 && (
            <p className="pt-1 text-[11px] text-danger">
              El efectivo queda negativo. Si te falta un depósito, cargalo también.
            </p>
          )}
        </div>
      )}

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        Registrar {info.label.toLowerCase()}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Un número tipeado a mano, aceptando coma o punto como separador decimal: en
 * un teclado en español la coma es lo que sale, y `Number("1,5")` es `NaN`.
 */
function toNumber(raw: string): number {
  const parsed = Number(raw.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
