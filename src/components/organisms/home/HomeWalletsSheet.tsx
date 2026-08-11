"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, Switch, useSnackbar } from "lib-kit-components";
import { ROUTES } from "@/lib/app-config";
import type { Wallet } from "@/lib/data/wallets";
import { toggleWalletHomePinAction } from "@/lib/data/wallets-actions";
import { WALLET_COLORS } from "@/lib/wallet-model";

/**
 * Selector de qué billeteras aparecen en el carrusel de Inicio: una fila por
 * billetera con un `Switch`.
 *
 * Cada toque guarda al instante (`toggleWalletHomePinAction`), sin botón de
 * "Guardar": el toggle escribe un solo campo de un solo documento, así que no
 * hay nada que confirmar ni un borrador que perder si el sheet se cierra a
 * mitad de camino. Pintado optimista, igual que `PinLockSwitch`.
 */
interface HomeWalletsSheetProps {
  wallets: Wallet[];
}

export function HomeWalletsSheet({ wallets }: HomeWalletsSheetProps) {
  if (wallets.length === 0) {
    return (
      <div className="space-y-3 py-2 text-center">
        <p className="text-sm text-muted">
          Todavía no creaste ninguna billetera. Creá la primera en la mini-app y después
          elegí cuáles ver acá.
        </p>
        <Link
          href={ROUTES.miniAppBilletera}
          className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Ir a Billetera
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {wallets.map((wallet) => (
        <WalletPinRow key={wallet.id} wallet={wallet} />
      ))}
    </div>
  );
}

function WalletPinRow({ wallet }: { wallet: Wallet }) {
  const { snack } = useSnackbar();
  const [, startTransition] = useTransition();
  /**
   * Estado local y no `useOptimistic` como `PinLockSwitch`: el sheet global
   * guarda el contenido que le pasan como un nodo ya construido, así que este
   * componente **no recibe props nuevas** cuando `revalidatePath` trae los
   * datos actualizados. `useOptimistic` descarta su valor al terminar la
   * transición y vuelve al que le pasaron — que acá sigue congelado en el de
   * antes del toggle, así que el switch se volvería solo a su posición
   * anterior aunque el guardado hubiera salido bien. Con estado local, el
   * valor que muestra es el que el usuario eligió, y sólo se revierte si la
   * escritura falla de verdad.
   */
  const [pinned, setPinned] = useState(wallet.pinnedToHome);

  function toggle(next: boolean) {
    setPinned(next);
    startTransition(async () => {
      try {
        await toggleWalletHomePinAction(wallet.id, next);
      } catch (error) {
        setPinned(!next);
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el cambio.",
          variant: "error",
        });
      }
    });
  }

  return (
    <Card variant="outline" padding="sm">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${WALLET_COLORS[wallet.color].soft}`}
        >
          {wallet.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{wallet.name}</p>
          {wallet.purpose && <p className="truncate text-[11px] text-muted">{wallet.purpose}</p>}
        </div>
        <Switch checked={pinned} onChange={toggle} />
      </div>
    </Card>
  );
}
