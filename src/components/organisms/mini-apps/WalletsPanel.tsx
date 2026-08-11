"use client";

import { useState } from "react";
import { Button, Card, CardHeader, PageStatusScreen, ProgressBar } from "lib-kit-components";
import { PlusIcon, SettingsIcon } from "@/components/atoms/icons";
import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import { useAppSheet } from "@/components/shell/app-sheet";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import type { WalletWithContents } from "@/lib/data/wallets";
import {
  formatAmount,
  formatGainPct,
  MAX_WALLETS,
  WALLET_COLORS,
  WALLET_KINDS,
  walletHeadline,
  walletProgress,
} from "@/lib/wallet-model";
import { MODULE_ID } from "./wallet-tabs";
import { WalletComposer } from "./WalletComposer";
import { WalletDetailModal } from "./WalletDetailModal";

/**
 * Tab "Billeteras": la grilla de billeteras del usuario, cada una con el
 * número que le corresponde a su tipo (saldo, deuda o valor de la cartera).
 *
 * A diferencia del gestor de gastos ("Principal"), acá no hay período: una
 * billetera es una bolsa viva. Los datos bajan resueltos desde la página y el
 * detalle sale de esa misma lista —por id, no por copia— para que al cargar un
 * movimiento el modal se vuelva a pintar con lo que devolvió el server.
 *
 * **No hay un total de todas juntas**: cada billetera tiene su propia moneda y
 * sumarlas exigiría una cotización que la app todavía no tiene. Mostrar un
 * número que suma pesos con dólares sería peor que no mostrar ninguno.
 */
interface WalletsPanelProps {
  today: string;
  wallets: WalletWithContents[];
  /** ABM de categorías del usuario: el alta de un gasto de billetera usa el mismo que Movimientos. */
  categories: ExpenseCategoryItem[];
  pinSet: boolean;
  locked: boolean;
  /**
   * Billetera cuyo detalle hay que abrir al montar, cuando se llegó por el deep
   * link del carrusel de Inicio (`?billetera={id}`, ya validado por
   * `WalletApp`). `null` = se entró a la tab de la forma normal.
   */
  openWalletId?: string | null;
}

export function WalletsPanel({
  today,
  wallets,
  categories,
  pinSet,
  locked,
  openWalletId = null,
}: WalletsPanelProps) {
  const { openSheet } = useAppSheet();
  // Estado inicial perezoso, no un efecto: el detalle del deep link tiene que
  // estar abierto ya en el primer render (sin un frame con el modal cerrado), y
  // como es *inicial* el usuario lo puede cerrar sin que se vuelva a abrir solo.
  const [detailId, setDetailId] = useState<string | null>(() => openWalletId);

  // El detalle se resuelve por id contra la lista de props en cada render (no
  // se guarda la billetera en estado): así, después de un `revalidatePath`, el
  // modal abierto muestra el saldo y los movimientos nuevos en vez de los que
  // tenía cuando se abrió.
  const detail = wallets.find((wallet) => wallet.id === detailId) ?? null;

  const full = wallets.length >= MAX_WALLETS;

  const openComposer = () =>
    openSheet(<WalletComposer />, {
      title: "Nueva billetera",
      description: "Una bolsa aparte para un fin puntual: ahorro, casa, un viaje.",
    });

  const openSettings = () =>
    openSheet(<PinLockSwitch moduleId={MODULE_ID} locked={locked} pinConfigured={pinSet} />, {
      title: "Ajustes",
      description: "Privacidad de Billetera.",
    });

  return (
    <div className="space-y-4">
      <Card variant="glass" padding="md">
        <CardHeader
          title="Mis billeteras"
          subtitle={
            wallets.length === 0
              ? "Todavía no creaste ninguna."
              : `${wallets.length} ${wallets.length === 1 ? "billetera" : "billeteras"}`
          }
          aside={
            <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettings}>
              <SettingsIcon />
            </Button>
          }
        />
        <Button
          className="mt-3"
          fullWidth
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          disabled={full}
          onClick={openComposer}
        >
          Nueva billetera
        </Button>
        {full && (
          <p className="mt-2 text-center text-xs text-muted">
            Llegaste al máximo de {MAX_WALLETS} billeteras.
          </p>
        )}
      </Card>

      {wallets.length === 0 ? (
        <PageStatusScreen
          status="empty"
          title="Una billetera para cada cosa"
          description="Creá una para el ahorro del auto, otra para la casa, otra para el próximo viaje — cada una con su saldo y sus movimientos."
          primary={{ label: "Crear la primera", onClick: openComposer }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {wallets.map((wallet) => {
            const style = WALLET_COLORS[wallet.color];
            const info = WALLET_KINDS[wallet.kind];
            const headline = walletHeadline(wallet.kind, wallet.totals, wallet.investment);
            const progress = walletProgress(wallet.kind, wallet, wallet.totals);

            return (
              <Card
                key={wallet.id}
                variant="elevated"
                padding="md"
                interactive
                onClick={() => setDetailId(wallet.id)}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${style.soft}`}
                  >
                    {wallet.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{wallet.name}</p>
                    <p className="truncate text-[11px] text-muted">
                      {info.label} · {wallet.currency}
                      {wallet.purpose ? ` · ${wallet.purpose}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-base font-bold tabular-nums ${
                        headline.negative ? "text-danger" : style.text
                      }`}
                    >
                      {formatAmount(headline.amount, wallet.currency, headline.decimals)}
                    </p>
                    {/* En una cartera, el número de arriba es cuánto vale; lo
                        que interesa al lado es si eso es más o menos de lo que
                        se puso. Sin cotizaciones cargadas no se muestra nada,
                        en vez de un 0% que se leería como "ni ganó ni perdió". */}
                    {wallet.investment && wallet.investment.netContributed > 0 && (
                      <p
                        className={`text-[11px] font-semibold tabular-nums ${
                          wallet.investment.totalGain < 0 ? "text-danger" : "text-success"
                        }`}
                      >
                        {formatGainPct(wallet.investment.totalGainPct)}
                      </p>
                    )}
                  </div>
                </div>

                {progress && (
                  <ProgressBar
                    className="mt-3"
                    value={progress.pct}
                    tone={progress.over ? "danger" : style.progress}
                    label={`${progress.label} ${formatAmount(progress.total, wallet.currency)}`}
                    showValue
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      <WalletDetailModal
        wallet={detail}
        today={today}
        categories={categories}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
