"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MovementsPanel } from "@/components/organisms/home/MovementsPanel";
import { useShellTabs } from "@/components/shell/shell-tabs";
import { ROUTES } from "@/lib/app-config";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";
import type { ExpenseCycle } from "@/lib/data/expenses";
import type { Movement } from "@/lib/data/home";
import type { WalletWithContents } from "@/lib/data/wallets";
import { WalletsPanel } from "./WalletsPanel";
import { isWalletTab, type WalletTab } from "./wallet-tabs";

/**
 * Mini-app privada **Billetera**: la extensión del gestor de gastos a varias
 * billeteras.
 *
 * La tab "Principal" es literalmente el `MovementsPanel` de la tab Movimientos
 * de Inicio — el mismo componente y las mismas colecciones
 * (`expenseCycles`/`expenseMovements`), no una copia: el gestor de gastos por
 * período sigue siendo uno solo, y acá se lo muestra al lado de las billeteras
 * extra en vez de duplicarlo. Su candado de PinLock también es el suyo
 * (`movimientos`), distinto del de la mini-app (`billetera`), que tapa la
 * pantalla entera desde la página.
 *
 * Las tabs no las monta esta pantalla: viven en la fila extra del `AppHeader`
 * del shell, declaradas en `nav-config` — mismo patrón que `WorkoutTrainer`.
 */
interface WalletAppProps {
  today: string;
  wallets: WalletWithContents[];
  expenseCycle: ExpenseCycle | null;
  cycleMovements: Movement[];
  categories: ExpenseCategoryItem[];
  pinSet: boolean;
  /** Candado del módulo `movimientos`, el del gestor de gastos de Inicio. */
  movementsLocked: boolean;
  /** Candado de esta mini-app. Llega hasta acá sólo para el switch de sus ajustes: el gate ya lo aplicó la página. */
  walletLocked: boolean;
  /**
   * Billetera pedida por query param (`?billetera={id}`), ya resuelta en el
   * server. Llegar así abre la tab "Billeteras" con su detalle desplegado — es
   * lo que hace que el carrusel de accesos directos de Inicio "navegue a" una
   * billetera puntual. `null` = se entró a la mini-app de la forma normal.
   */
  initialWalletId: string | null;
}

export function WalletApp({
  today,
  wallets,
  expenseCycle,
  cycleMovements,
  categories,
  pinSet,
  movementsLocked,
  walletLocked,
  initialWalletId,
}: WalletAppProps) {
  const { tab, setTab } = useShellTabs();
  const active: WalletTab = isWalletTab(tab) ? tab : "principal";

  /**
   * La tab activa es estado del shell (`AppShell`), que arranca siempre en la
   * primera y no sabe nada de query params. Este efecto corre una sola vez, al
   * montar con un `?billetera=` que exista, y mueve la pantalla a "Billeteras".
   *
   * Después **saca el query param de la URL** (`router.replace`): el deep link
   * es de un solo uso —ya cumplió su función de abrir el detalle— y dejarlo
   * puesto haría que volver a esta tab lo reabriera, o que compartir el link de
   * "la mini-app" arrastrara una billetera puntual. `WalletsPanel` ya latcheó
   * el id al montar, así que el detalle abierto no se cierra al limpiarla.
   */
  // El latch va en un ref y no en estado: sólo tiene que evitar que el efecto
  // se aplique dos veces (StrictMode monta y desmonta cada componente en dev),
  // y no hay nada que repintar cuando cambia.
  const deepLinkApplied = useRef(false);
  const router = useRouter();
  const deepLinkWalletId = wallets.some((wallet) => wallet.id === initialWalletId)
    ? initialWalletId
    : null;

  useEffect(() => {
    if (!deepLinkWalletId || deepLinkApplied.current) return;
    deepLinkApplied.current = true;
    setTab("billeteras");
    router.replace(ROUTES.miniAppBilletera, { scroll: false });
  }, [deepLinkWalletId, setTab, router]);

  if (active === "billeteras") {
    return (
      <WalletsPanel
        today={today}
        wallets={wallets}
        categories={categories}
        pinSet={pinSet}
        locked={walletLocked}
        openWalletId={deepLinkWalletId}
      />
    );
  }

  return (
    <MovementsPanel
      today={today}
      expenseCycle={expenseCycle}
      cycleMovements={cycleMovements}
      expenseCategories={categories}
      pinSet={pinSet}
      locked={movementsLocked}
    />
  );
}
