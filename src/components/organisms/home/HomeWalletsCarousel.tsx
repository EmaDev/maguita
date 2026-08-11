"use client";

import Link from "next/link";
import { Button, Card, CardHeader, ProgressBar } from "lib-kit-components";
import { PlusIcon, WalletIcon } from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { ROUTES, walletDetailHref } from "@/lib/app-config";
import type { WalletShortcuts, WalletWithTotals } from "@/lib/data/wallets";
import {
  formatAmount,
  formatGainPct,
  WALLET_COLORS,
  WALLET_KINDS,
  walletHeadline,
  walletProgress,
} from "@/lib/wallet-model";
import { HomeWalletsSheet } from "./HomeWalletsSheet";

/**
 * Carrusel de accesos directos a billeteras, en el Resumen de Inicio. Cada
 * card es un `Link` a su billetera dentro de la mini-app
 * (`walletDetailHref` → `?billetera={id}`, que abre su detalle ya montado).
 *
 * Cuál aparece lo elige el usuario, billetera por billetera, desde el sheet de
 * `HomeWalletsSheet` — no se muestran todas automáticamente: el Resumen es un
 * índice, y doce cards de billetera lo volverían la pantalla de otra cosa.
 *
 * Es scroll horizontal con `snap`, la misma mecánica que el carrusel de
 * "Períodos anteriores" (`PastExpenseCyclesSection`), en vez del `Carousel` de
 * `lib-kit-components`, que es un visor de imágenes con flechas y dots.
 */
interface HomeWalletsCarouselProps {
  shortcuts: WalletShortcuts;
}

export function HomeWalletsCarousel({ shortcuts }: HomeWalletsCarouselProps) {
  const { openSheet } = useAppSheet();
  const { all, pinned } = shortcuts;

  const openPicker = () =>
    openSheet(<HomeWalletsSheet wallets={all} />, {
      title: "Billeteras en Inicio",
      description: "Elegí cuáles querés tener a mano acá.",
    });

  // Sin ninguna billetera creada, la sección no se muestra: sería un hueco que
  // sólo dice "no tenés esto" en una pantalla que es un índice de lo que sí
  // tenés. La mini-app se descubre desde /mini-apps, como el resto.
  if (all.length === 0) return null;

  return (
    <Card variant="glass" padding="md">
      <CardHeader
        title="Billeteras"
        subtitle={
          pinned.length === 0
            ? "Elegí cuáles ver acá."
            : `${pinned.length} ${pinned.length === 1 ? "acceso directo" : "accesos directos"}`
        }
        aside={
          <Button size="sm" variant="ghost" onClick={openPicker}>
            Elegir
          </Button>
        }
      />

      {pinned.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <WalletIcon className="h-5 w-5" />
          </span>
          <p className="flex-1 text-xs text-muted">
            Fijá las billeteras que más usás y entrá a cada una de un toque.
          </p>
          <Button size="sm" variant="secondary" onClick={openPicker}>
            Elegir
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {pinned.map((wallet) => (
            <WalletShortcutCard key={wallet.id} wallet={wallet} />
          ))}

          {/* Última card del carrusel, no un botón aparte: agregar otro acceso
              directo es la continuación natural de la fila, y así el gesto de
              scrollear hasta el final ya lo deja a mano. */}
          <button
            type="button"
            onClick={openPicker}
            aria-label="Elegir billeteras en Inicio"
            className="flex w-28 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="text-xs font-semibold">Agregar</span>
          </button>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="mt-3 border-t border-border pt-3 text-right">
          <Link href={ROUTES.miniAppBilletera} className="text-xs font-semibold text-primary">
            Ver todas
          </Link>
        </div>
      )}
    </Card>
  );
}

function WalletShortcutCard({ wallet }: { wallet: WalletWithTotals }) {
  const style = WALLET_COLORS[wallet.color];
  const info = WALLET_KINDS[wallet.kind];
  const headline = walletHeadline(wallet.kind, wallet.totals, wallet.investment);
  const progress = walletProgress(wallet.kind, wallet, wallet.totals);

  return (
    <Link href={walletDetailHref(wallet.id)} className="block w-44 shrink-0 snap-start">
      <Card variant="outline" padding="md" interactive className="h-full">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`grid h-10 w-10 place-items-center rounded-full text-lg ${style.soft}`}
          >
            {wallet.emoji}
          </span>
          {/* La moneda va siempre visible: con billeteras en distintas monedas,
              el símbolo solo no alcanza para saber cuál es cuál de un vistazo. */}
          <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {wallet.currency}
          </span>
        </div>

        <p className="mt-2 truncate text-sm font-semibold text-foreground">{wallet.name}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-muted">
          {headline.label}
        </p>
        <p
          className={`truncate text-lg font-bold tabular-nums ${
            headline.negative ? "text-danger" : style.text
          }`}
        >
          {formatAmount(headline.amount, wallet.currency, headline.decimals)}
        </p>

        {progress ? (
          <ProgressBar
            className="mt-2"
            value={progress.pct}
            tone={progress.over ? "danger" : style.progress}
            size="sm"
          />
        ) : wallet.investment && wallet.investment.netContributed > 0 ? (
          <p
            className={`mt-1 truncate text-[11px] font-semibold tabular-nums ${
              wallet.investment.totalGain < 0 ? "text-danger" : "text-success"
            }`}
          >
            {formatGainPct(wallet.investment.totalGainPct)}
          </p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-muted">
            {wallet.purpose ?? info.description}
          </p>
        )}
      </Card>
    </Link>
  );
}
