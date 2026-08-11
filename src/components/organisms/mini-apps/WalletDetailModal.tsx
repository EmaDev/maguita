"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Modal, ProgressBar, Switch, useSnackbar } from "lib-kit-components";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/atoms/icons";
import { MovementsList } from "@/components/organisms/home/MovementsList";
import { useAppSheet } from "@/components/shell/app-sheet";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import type { WalletWithContents } from "@/lib/data/wallets";
import {
  deleteWalletAction,
  deleteWalletMovementAction,
  toggleWalletHomePinAction,
} from "@/lib/data/wallets-actions";
import {
  formatAmount,
  formatGainPct,
  formatSignedAmount,
  PRICE_DECIMALS,
  TRADE_KINDS,
  WALLET_COLORS,
  WALLET_KINDS,
  walletHeadline,
  walletProgress,
  type TradeKind,
} from "@/lib/wallet-model";
import { NewWalletMovementSheet } from "./NewWalletMovementSheet";
import { WalletComposer } from "./WalletComposer";
import { WalletHoldingsList } from "./WalletHoldingsList";
import { WalletTradeComposer } from "./WalletTradeComposer";
import { WalletTradesList } from "./WalletTradesList";

/**
 * Detalle de una billetera. Lo que muestra abajo del encabezado depende de su
 * tipo: **posiciones** en una de inversión (con su rendimiento) y
 * **movimientos** en el resto. El encabezado en cambio es el mismo para todas
 * — sólo cambia qué dice, y eso ya lo resuelve `walletHeadline`.
 *
 * Es un `Modal` y no un sheet del shell a propósito: el sheet global guarda el
 * contenido que le pasan como un nodo ya construido, así que no se re-renderiza
 * cuando `revalidatePath` trae datos nuevos — el saldo y la lista se quedarían
 * congelados al cargar algo desde adentro. Acá, en cambio, el panel le pasa la
 * billetera que acaba de recibir del server en cada render.
 *
 * Las altas y la edición sí abren el sheet global: son formularios que se
 * cierran al guardar, no vistas que tengan que verse actualizadas.
 */
interface WalletDetailModalProps {
  wallet: WalletWithContents | null;
  today: string;
  categories: ExpenseCategoryItem[];
  onClose: () => void;
}

export function WalletDetailModal({ wallet, today, categories, onClose }: WalletDetailModalProps) {
  const { openSheet, closeSheet } = useAppSheet();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Pintado optimista, igual que `PinLockSwitch`: el switch no puede quedarse
  // en el valor viejo mientras va y vuelve la escritura.
  const [pinnedToHome, setPinnedToHome] = useOptimistic(wallet?.pinnedToHome ?? false);

  function togglePin(next: boolean) {
    if (!wallet) return;
    startTransition(async () => {
      setPinnedToHome(next);
      try {
        await toggleWalletHomePinAction(wallet.id, next);
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el cambio.",
          variant: "error",
        });
      }
    });
  }

  function removeWallet() {
    if (!wallet) return;
    startTransition(async () => {
      try {
        await deleteWalletAction(wallet.id);
        snack({ message: "Billetera eliminada.", variant: "success" });
        onClose();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar la billetera.",
          variant: "error",
        });
      }
    });
  }

  function removeMovement(movementId: string) {
    startTransition(async () => {
      try {
        await deleteWalletMovementAction(movementId);
        snack({ message: "Movimiento eliminado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar el movimiento.",
          variant: "error",
        });
      }
    });
  }

  if (!wallet) return <Modal open={false} onClose={onClose} />;

  const info = WALLET_KINDS[wallet.kind];
  const style = WALLET_COLORS[wallet.color];
  const headline = walletHeadline(wallet.kind, wallet.totals, wallet.investment);
  const progress = walletProgress(wallet.kind, wallet, wallet.totals);
  const { currency } = wallet;

  const openMovementSheet = (kind: "expense" | "income") =>
    openSheet(
      <NewWalletMovementSheet
        walletId={wallet.id}
        walletName={wallet.name}
        currency={currency}
        date={today}
        kind={kind}
        categories={kind === "expense" ? categories : []}
        onSaved={closeSheet}
      />,
      { title: movementSheetTitle(wallet.kind, kind) }
    );

  const openTradeSheet = (kind: TradeKind) =>
    openSheet(
      <WalletTradeComposer
        walletId={wallet.id}
        currency={currency}
        today={today}
        kind={kind}
        trades={wallet.trades}
        quotes={wallet.quotes}
        cash={wallet.investment?.cash ?? 0}
        onSaved={closeSheet}
      />,
      {
        title: TRADE_KINDS[kind].label,
        description: TRADE_DESCRIPTIONS[kind],
      }
    );

  const openEditSheet = () =>
    openSheet(<WalletComposer wallet={wallet} />, {
      title: "Editar billetera",
      description: "Nombre, ícono, color y los montos de su tipo.",
    });

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${wallet.emoji} ${wallet.name}`}
      description={wallet.purpose ?? undefined}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface-alt/60 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {headline.label}
            </p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {info.emoji} {info.label} · {currency}
            </span>
          </div>

          <p
            className={`mt-1 text-3xl font-bold tabular-nums ${
              headline.negative ? "text-danger" : style.text
            }`}
          >
            {formatAmount(headline.amount, currency, headline.decimals)}
          </p>

          {wallet.investment ? (
            <InvestmentSummary wallet={wallet} />
          ) : (
            <p className="mt-1 text-xs text-muted">
              {info.isDebt
                ? `${formatAmount(wallet.initialBalance, currency)} de deuda inicial · ${formatAmount(wallet.totals.spent, currency)} en consumos · ${formatAmount(wallet.totals.income, currency)} en pagos`
                : `Arrancó en ${formatAmount(wallet.initialBalance, currency)} · ${formatAmount(wallet.totals.income, currency)} de ingresos · ${formatAmount(wallet.totals.spent, currency)} de gastos`}
            </p>
          )}

          {progress && (
            <ProgressBar
              className="mt-3"
              value={progress.pct}
              tone={progress.over ? "danger" : style.progress}
              label={`${progress.label}: ${formatAmount(progress.total, currency)}`}
              showValue
            />
          )}
        </div>

        <Switch
          checked={pinnedToHome}
          onChange={togglePin}
          label="Mostrar en Inicio"
          description="La agrega al carrusel de accesos directos del Resumen."
        />

        {info.usesPositions && wallet.investment ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {TRADE_ACTIONS.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={kind === "compra" ? "primary" : "secondary"}
                  leftIcon={<span aria-hidden="true">{TRADE_KINDS[kind].emoji}</span>}
                  onClick={() => openTradeSheet(kind)}
                >
                  {TRADE_KINDS[kind].label}
                </Button>
              ))}
            </div>

            <section className="space-y-2">
              <SectionTitle
                title="Tenencias"
                hint={
                  wallet.investment.holdings.length > 0
                    ? `${wallet.investment.pricedCount} de ${wallet.investment.holdings.length} con cotización`
                    : undefined
                }
              />
              {wallet.investment.holdings.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  Todavía no tenés nada comprado en esta cartera.
                </p>
              ) : (
                <WalletHoldingsList
                  walletId={wallet.id}
                  holdings={wallet.investment.holdings}
                  currency={currency}
                  quotesUpdatedAt={wallet.quotesUpdatedAt}
                />
              )}
            </section>

            {wallet.investment.closed.length > 0 && (
              <section className="space-y-2">
                <SectionTitle title="Ya vendidas" />
                {wallet.investment.closed.map((holding) => (
                  <div
                    key={holding.assetSymbol}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs"
                  >
                    <span className="truncate font-semibold text-foreground">
                      {holding.assetSymbol}
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        holding.realizedGain < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatSignedAmount(holding.realizedGain, currency, PRICE_DECIMALS)}
                    </span>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <SectionTitle
                title="Operaciones"
                hint={`${wallet.trades.length} ${wallet.trades.length === 1 ? "asiento" : "asientos"}`}
              />
              {wallet.trades.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  Arrancá con un depósito y después comprá tu primer activo.
                </p>
              ) : (
                <WalletTradesList
                  trades={wallet.trades}
                  currency={currency}
                  today={today}
                />
              )}
            </section>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                variant="secondary"
                leftIcon={<PlusIcon className="w-4 h-4" />}
                onClick={() => openMovementSheet("income")}
              >
                {info.isDebt ? "Pago" : "Ingreso"}
              </Button>
              <Button
                className="flex-1"
                size="sm"
                leftIcon={<PlusIcon className="w-4 h-4" />}
                onClick={() => openMovementSheet("expense")}
              >
                {info.isDebt ? "Consumo" : "Gasto"}
              </Button>
            </div>

            {wallet.movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Todavía no cargaste movimientos en esta billetera.
              </p>
            ) : (
              <MovementsList
                movements={wallet.movements}
                today={today}
                deleting={pending}
                onDelete={(movement) => removeMovement(movement.id)}
              />
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<PencilIcon className="w-4 h-4" />}
            onClick={openEditSheet}
          >
            Editar
          </Button>
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger" loading={pending} onClick={removeWallet}>
                Eliminar todo
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<TrashIcon className="w-4 h-4" />}
              onClick={() => setConfirmingDelete(true)}
            >
              Eliminar
            </Button>
          )}
        </div>
        {confirmingDelete && (
          <p className="text-xs text-danger">
            Se borra la billetera y{" "}
            {info.usesPositions
              ? `sus ${wallet.trades.length} operaciones`
              : `sus ${wallet.totals.movementCount} movimientos`}
            . No se puede deshacer.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Botones de operación, en el orden en que se usan al armar una cartera:
 * primero entra plata, después se compra, después se vende, y al final los
 * casos ocasionales. Están las seis del registro — una operación que el modelo
 * sabe asentar pero la pantalla no ofrece sería una que nadie puede usar.
 */
const TRADE_ACTIONS: TradeKind[] = [
  "deposito",
  "compra",
  "venta",
  "retiro",
  "dividendo",
  "comision",
];

const TRADE_DESCRIPTIONS: Record<TradeKind, string> = {
  deposito: "Plata que entra a la cartera y queda sin invertir.",
  retiro: "Plata que sacás de la cartera. Sale del efectivo sin invertir.",
  compra: "Sale efectivo, entra tenencia.",
  venta: "Sale tenencia, y el importe queda como efectivo sin invertir.",
  dividendo: "Plata que paga un activo, sin tocar la tenencia.",
  comision: "Un costo que sale del efectivo, sin tocar la tenencia.",
};

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * De qué se compone el valor de la cartera: el efectivo sin invertir, lo que
 * está invertido y el resultado, separando lo **realizado** (ventas ya hechas,
 * plata que no se puede perder) de lo **no realizado** (lo que valdría si
 * vendiera hoy). Son dos números distintos y mezclarlos escondería justamente
 * lo que el usuario quiere saber después de vender.
 */
function InvestmentSummary({ wallet }: { wallet: WalletWithContents }) {
  const totals = wallet.investment;
  if (!totals) return null;

  const { currency } = wallet;
  const missing = totals.holdings.length - totals.pricedCount;

  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">Efectivo sin invertir</span>
        <span
          className={`font-semibold tabular-nums ${totals.cash < 0 ? "text-danger" : "text-foreground"}`}
        >
          {formatAmount(totals.cash, currency, PRICE_DECIMALS)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">Invertido (a costo)</span>
        <span className="font-semibold tabular-nums text-foreground">
          {formatAmount(totals.invested, currency, PRICE_DECIMALS)}
        </span>
      </div>
      {totals.realizedGain !== 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Resultado realizado</span>
          <span
            className={`font-semibold tabular-nums ${
              totals.realizedGain < 0 ? "text-danger" : "text-success"
            }`}
          >
            {formatSignedAmount(totals.realizedGain, currency, PRICE_DECIMALS)}
          </span>
        </div>
      )}
      {totals.pricedCount > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Sin realizar</span>
          <span
            className={`font-semibold tabular-nums ${
              totals.unrealizedGain < 0 ? "text-danger" : "text-success"
            }`}
          >
            {formatSignedAmount(totals.unrealizedGain, currency, PRICE_DECIMALS)}
          </span>
        </div>
      )}
      {totals.netContributed > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-1">
          <span className="text-muted">Total sobre lo aportado</span>
          <span
            className={`font-semibold tabular-nums ${
              totals.totalGain < 0 ? "text-danger" : "text-success"
            }`}
          >
            {formatSignedAmount(totals.totalGain, currency, PRICE_DECIMALS)} (
            {formatGainPct(totals.totalGainPct)})
          </span>
        </div>
      )}
      {missing > 0 && (
        <p className="pt-1 text-[11px] text-muted">
          {missing === totals.holdings.length
            ? "Todavía sin cotizaciones: lo invertido se valúa a su costo."
            : `${missing} ${missing === 1 ? "tenencia" : "tenencias"} sin cotización — el valor es parcial.`}
        </p>
      )}
      {totals.hasInconsistencies && (
        <p className="pt-1 text-[11px] text-danger">
          Hay ventas sin la compra que las respalde. Revisá las operaciones.
        </p>
      )}
    </div>
  );
}

/**
 * Cómo se llama cargar plata en cada tipo. En una billetera de crédito lo que
 * se carga no es un "gasto" sino un consumo, y lo que la baja es un pago —
 * misma escritura, otro nombre.
 */
function movementSheetTitle(
  walletKind: WalletWithContents["kind"],
  movementKind: "expense" | "income"
): string {
  if (WALLET_KINDS[walletKind].isDebt) {
    return movementKind === "expense" ? "Nuevo consumo" : "Nuevo pago";
  }
  return movementKind === "expense" ? "Nuevo gasto" : "Nuevo ingreso";
}
