import type { Metadata } from "next";
import { WalletApp } from "@/components/organisms/mini-apps/WalletApp";
import { MODULE_ID } from "@/components/organisms/mini-apps/wallet-tabs";
import { ModuleLockGate } from "@/components/organisms/security/ModuleLockGate";
import { ROUTES, WALLET_QUERY_PARAM } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getExpenseCategories } from "@/lib/data/expense-categories";
import { getActiveExpenseCycle, getExpenseMovements } from "@/lib/data/expenses";
import { getProfile } from "@/lib/data/profile";
import { getWalletsWithContents } from "@/lib/data/wallets";
import { dayKey } from "@/lib/home-model";

export const metadata: Metadata = { title: "Billetera" };

/**
 * `searchParams` es una Promise (es una Request-time API): hay que esperarla
 * para leer el `?billetera={id}` con el que el carrusel de Inicio entra derecho
 * a una billetera. Se resuelve acá, en el server, y baja como prop — mismo
 * criterio que `today`: el cliente no vuelve a leer la URL por su cuenta.
 */
interface BilleteraPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BilleteraPage({ searchParams }: BilleteraPageProps) {
  const session = await requireSession(ROUTES.miniAppBilletera);

  // Un query param repetido (`?billetera=a&billetera=b`) llega como array: se
  // descarta en vez de quedarse con uno, no es una URL que la app genere.
  const requested = (await searchParams)[WALLET_QUERY_PARAM];
  const initialWalletId = typeof requested === "string" ? requested : null;

  const [wallets, expenseCycle, categories, profile] = await Promise.all([
    getWalletsWithContents(session.sub),
    getActiveExpenseCycle(session.sub),
    getExpenseCategories(session.sub),
    getProfile(session.sub),
  ]);
  // Los movimientos del ciclo dependen de cuál es el ciclo activo, así que no
  // pueden ir en el `Promise.all` de arriba — mismo encadenado que `getHomeData`.
  const cycleMovements = expenseCycle ? await getExpenseMovements(expenseCycle.id) : [];

  const pinSet = Boolean(profile?.preferences.pinHash);
  const lockedModules = profile?.preferences.lockedModules ?? [];

  return (
    <ModuleLockGate
      moduleId={MODULE_ID}
      moduleLabel="Billetera"
      locked={pinSet && lockedModules.includes(MODULE_ID)}
    >
      <WalletApp
        // El día lo resuelve el server y baja como prop, igual que en Inicio:
        // que el cliente no lo recalcule evita que el HTML del server y el
        // primer render del browser difieran cuando están en husos distintos.
        today={dayKey(new Date())}
        wallets={wallets}
        expenseCycle={expenseCycle}
        cycleMovements={cycleMovements}
        categories={categories}
        pinSet={pinSet}
        movementsLocked={pinSet && lockedModules.includes("movimientos")}
        walletLocked={pinSet && lockedModules.includes(MODULE_ID)}
        initialWalletId={initialWalletId}
      />
    </ModuleLockGate>
  );
}
