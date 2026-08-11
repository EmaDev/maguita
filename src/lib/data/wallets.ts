import "server-only";
import {
  COLLECTIONS,
  collection,
  withId,
  type CurrencyCode,
  type WalletColor,
  type WalletDoc,
  type WalletKind,
  type WalletTradeDoc,
} from "@/lib/firebase/collections";
import { byDayDesc } from "@/lib/home-model";
import {
  isAssetType,
  isCurrencyCode,
  isTradeKind,
  isWalletColor,
  isWalletKind,
  portfolio,
  walletTotals,
  DEFAULT_CURRENCY,
  DEFAULT_WALLET_COLOR,
  DEFAULT_WALLET_KIND,
  WALLET_KINDS,
  type Portfolio,
  type TradeEntry,
  type WalletTotals,
} from "@/lib/wallet-model";
import type { Movement } from "./home";

/**
 * Billeteras de la mini-app **Billetera** (`/mini-apps/billetera`): varias
 * bolsas de plata, cada una para un fin distinto, con su saldo y sus
 * movimientos.
 *
 * La tab "Principal" de esa mini-app **no** pasa por acá: sigue leyendo
 * `expenseCycles`/`expenseMovements` con `lib/data/expenses.ts`, sin cambios.
 */

export interface Wallet {
  id: string;
  name: string;
  emoji: string;
  color: WalletColor;
  /** Qué administra: gastos, ahorro, crédito o inversión. Fijo desde el alta. */
  kind: WalletKind;
  /** Moneda de todos sus montos. Fija desde el alta. */
  currency: CurrencyCode;
  purpose: string | null;
  initialBalance: number;
  targetAmount: number | null;
  /** Límite de la tarjeta/préstamo, sólo en `kind: "credito"`. */
  creditLimit: number | null;
  /** Si está fijada como acceso directo en el carrusel de Inicio. */
  pinnedToHome: boolean;
  /**
   * Última cotización conocida por símbolo, ya aplanada a `precio` (sin el
   * `Timestamp`, que no serializa hacia un Client Component). `{}` en todo lo
   * que no sea una cartera con precios cargados.
   */
  quotes: Record<string, number>;
  /** Cuándo se actualizó cada cotización, en milisegundos. Mismas claves que `quotes`. */
  quotesUpdatedAt: Record<string, number>;
  /** `createdAt` en milisegundos: un `Timestamp` de Firestore no serializa hacia un Client Component. */
  createdAt: number;
}

/** Un asiento del libro de una cartera, como lo consume la pantalla. */
export interface WalletTrade extends TradeEntry {
  walletId: string;
  note: string | null;
}

/**
 * Una billetera con sus totales ya resueltos, sin el detalle de lo que lleva
 * adentro — lo que necesita una card.
 *
 * Trae los dos juegos de totales porque cada tipo usa uno: `totals` (saldo de
 * movimientos) en gastos/ahorro/crédito, y `investment` (la cartera entera:
 * efectivo, tenencias y resultado) en inversión. `walletHeadline`
 * (`wallet-model.ts`) es la que elige cuál mostrar, así que ninguna pantalla
 * tiene que hacer ese `switch` por su cuenta.
 */
export interface WalletWithTotals extends Wallet {
  totals: WalletTotals;
  /** `null` en todo lo que no sea `kind: "inversion"`. */
  investment: Portfolio | null;
}

/**
 * Una billetera con todo lo que lleva adentro, que es como la consume la
 * grilla: los movimientos (gastos/ahorro/crédito) o el libro de operaciones
 * (inversión). El que no corresponde al tipo viene vacío.
 */
export interface WalletWithContents extends WalletWithTotals {
  movements: Movement[];
  trades: WalletTrade[];
}

/**
 * Parte el mapa `quotes` del documento en dos objetos planos y serializables:
 * un `Timestamp` de Firestore no cruza la frontera hacia un Client Component,
 * y el precio y su fecha se usan en lugares distintos de la UI.
 */
function flattenQuotes(
  quotes: WalletDoc["quotes"] | undefined
): Pick<Wallet, "quotes" | "quotesUpdatedAt"> {
  const prices: Record<string, number> = {};
  const updatedAt: Record<string, number> = {};
  for (const [symbol, quote] of Object.entries(quotes ?? {})) {
    if (typeof quote?.price !== "number") continue;
    prices[symbol] = quote.price;
    updatedAt[symbol] = quote.updatedAt?.toMillis() ?? 0;
  }
  return { quotes: prices, quotesUpdatedAt: updatedAt };
}

/**
 * Billeteras del usuario, más vieja primero (orden de alta). Filtra sólo por
 * `ownerId` (equality) y ordena en memoria — mismo criterio que
 * `getLinks`/`getNotes`, evita pedirle a Firestore un índice compuesto.
 */
export async function getWallets(userId: string): Promise<Wallet[]> {
  const snapshot = await collection(COLLECTIONS.wallets).where("ownerId", "==", userId).get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .map((data) => ({
      id: data.id,
      name: data.name,
      emoji: data.emoji,
      // Un documento viejo podría traer un color que ya no está en el
      // registro: se valida al leer y cae al default en vez de romper la
      // grilla, mismo criterio que `group`/`equipment` en `getCustomExercises`.
      color: isWalletColor(data.color) ? data.color : DEFAULT_WALLET_COLOR,
      // Mismo criterio para tipo y moneda, que además cubre a las billeteras
      // creadas antes de que existieran: sin el campo caen a "gastos" en ARS,
      // que es exactamente lo que eran.
      kind: isWalletKind(data.kind ?? "") ? data.kind : DEFAULT_WALLET_KIND,
      currency: isCurrencyCode(data.currency ?? "") ? data.currency : DEFAULT_CURRENCY,
      purpose: data.purpose ?? null,
      initialBalance: data.initialBalance,
      targetAmount: data.targetAmount ?? null,
      creditLimit: data.creditLimit ?? null,
      // Las billeteras creadas antes de que existiera el carrusel de Inicio no
      // traen el campo: se leen como "no fijada" en vez de migrarlas.
      pinnedToHome: data.pinnedToHome ?? false,
      ...flattenQuotes(data.quotes),
      createdAt: data.createdAt?.toMillis() ?? 0,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * **Todos** los movimientos de billetera del usuario, de una sola consulta por
 * `ownerId`, para agruparlos en memoria por `walletId`.
 *
 * Una consulta por billetera (o un `in` sobre sus ids) serían N lecturas o un
 * índice compuesto para traer exactamente los mismos documentos: la mini-app
 * muestra el saldo de todas las billeteras en la grilla y el detalle de
 * cualquiera al tocarla, así que igual las necesita todas. Es el mismo
 * criterio que `getWorkoutSessions`, que también se trae el historial entero.
 */
export async function getWalletMovements(userId: string): Promise<Movement[]> {
  const snapshot = await collection(COLLECTIONS.walletMovements)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => {
    const data = withId(doc);
    return {
      id: data.id,
      title: data.title,
      category: data.category,
      categoryEmoji: data.categoryEmoji,
      amount: data.amount,
      date: data.date,
      walletId: data.walletId,
    };
  });
}

/** Convierte un documento del libro a la forma que consume el fold y la UI. */
function toTrade(id: string, data: WalletTradeDoc): WalletTrade {
  return {
    id,
    walletId: data.walletId,
    kind: isTradeKind(data.kind ?? "") ? data.kind : "deposito",
    date: data.date,
    assetSymbol: data.assetSymbol ?? null,
    assetName: data.assetName ?? null,
    assetType: data.assetType && isAssetType(data.assetType) ? data.assetType : null,
    quantity: data.quantity ?? null,
    unitPrice: data.unitPrice ?? null,
    cashAmount: data.cashAmount,
    note: data.note ?? null,
    createdAt: data.createdAt?.toMillis() ?? 0,
  };
}

/**
 * **Todos** los asientos del libro del usuario, de una sola consulta por
 * `ownerId` — mismo criterio y mismo motivo que `getWalletMovements`.
 *
 * Sin ordenar acá a propósito: el orden que importa lo define `byTradeOrder`
 * (`wallet-model.ts`), que es el mismo que usa el fold. Ordenar en dos lugares
 * distintos es la forma más fácil de que el server y el cliente calculen
 * números distintos.
 */
export async function getWalletTrades(userId: string): Promise<WalletTrade[]> {
  const snapshot = await collection(COLLECTIONS.walletTrades)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => toTrade(doc.id, doc.data()));
}

/**
 * Agrupa una lista por `walletId` en un `Map`, que es lo que hacen las
 * lecturas de abajo con movimientos y asientos.
 */
function groupByWallet<T extends { walletId?: string }>(items: T[]): Map<string, T[]> {
  const byWallet = new Map<string, T[]>();
  for (const item of items) {
    if (!item.walletId) continue;
    const list = byWallet.get(item.walletId);
    if (list) list.push(item);
    else byWallet.set(item.walletId, [item]);
  }
  return byWallet;
}

/**
 * Junta una billetera con lo que le corresponde según su tipo. Es el único
 * lugar donde se decide "esta lleva movimientos, esta lleva un libro", y de
 * ahí salen los totales que después consumen las tres pantallas.
 */
function withContents(
  wallet: Wallet,
  movements: Movement[],
  trades: WalletTrade[]
): WalletWithContents {
  const usesPositions = WALLET_KINDS[wallet.kind].usesPositions;
  return {
    ...wallet,
    movements: usesPositions ? [] : byDayDesc(movements),
    trades: usesPositions ? trades : [],
    totals: walletTotals(wallet.initialBalance, usesPositions ? [] : movements),
    // El efectivo, las tenencias y el resultado no se leen de ningún
    // documento: se reconstruyen recorriendo el libro (ver `portfolio()`).
    investment: usesPositions ? portfolio(trades, wallet.quotes) : null,
  };
}

/**
 * Las billeteras del usuario con todo lo que llevan adentro. Es lo único que
 * la pantalla de la mini-app necesita: las tres consultas salen en paralelo y
 * el agrupado es en memoria.
 *
 * Las tres se piden siempre, aunque el usuario no tenga ninguna billetera de
 * inversión: saber si tiene alguna exige leer las billeteras primero, así que
 * condicionar la consulta del libro convertiría tres consultas paralelas
 * en dos rondas secuenciales — más lento en el caso normal para ahorrar una
 * consulta que devuelve vacío.
 */
export async function getWalletsWithContents(userId: string): Promise<WalletWithContents[]> {
  const [wallets, movements, trades] = await Promise.all([
    getWallets(userId),
    getWalletMovements(userId),
    getWalletTrades(userId),
  ]);

  const movementsByWallet = groupByWallet(movements);
  const tradesByWallet = groupByWallet(trades);

  return wallets.map((wallet) =>
    withContents(
      wallet,
      movementsByWallet.get(wallet.id) ?? [],
      tradesByWallet.get(wallet.id) ?? []
    )
  );
}

/**
 * Tope de valores que acepta un `in` de Firestore. Está muy por encima del
 * tope de billeteras por cuenta (`MAX_WALLETS`), así que el `in` de abajo
 * nunca puede pasarse — pero el número queda explícito para que se note si
 * alguna vez suben ese tope.
 */
const MAX_IN_VALUES = 30;

export interface WalletShortcuts {
  /** Todas las billeteras del usuario: es lo que lista el selector de "Elegir billeteras". */
  all: Wallet[];
  /** Sólo las fijadas (`pinnedToHome`), con su saldo — las cards del carrusel de Inicio. */
  pinned: WalletWithTotals[];
}

/**
 * Lo que Inicio necesita de la mini-app Billetera: todas las billeteras (para
 * el selector) y el saldo de las fijadas (para el carrusel de accesos
 * directos).
 *
 * A diferencia de `getWalletsWithContents` —que es la pantalla de la mini-app
 * y se trae todo— acá se pide con un `in` sobre los ids **fijados**: Inicio no
 * muestra el detalle de ninguna billetera, sólo su número principal, así que
 * traer lo de las que no están en el carrusel sería pagar lecturas por
 * documentos que nadie mira. Con ninguna fijada, ni siquiera consulta.
 *
 * Y el `in` va **separado por tipo**: sólo se piden movimientos si hay alguna
 * fijada que los use, y sólo asientos del libro si hay alguna de inversión. Un
 * carrusel de tres billeteras de gastos no toca `walletTrades`.
 */
export async function getWalletShortcuts(userId: string): Promise<WalletShortcuts> {
  const all = await getWallets(userId);
  const pinnedWallets = all.filter((wallet) => wallet.pinnedToHome).slice(0, MAX_IN_VALUES);
  if (pinnedWallets.length === 0) return { all, pinned: [] };

  const movementIds = pinnedWallets
    .filter((wallet) => !WALLET_KINDS[wallet.kind].usesPositions)
    .map((wallet) => wallet.id);
  const tradeIds = pinnedWallets
    .filter((wallet) => WALLET_KINDS[wallet.kind].usesPositions)
    .map((wallet) => wallet.id);

  const [movements, trades] = await Promise.all([
    movementIds.length > 0 ? movementsOf(movementIds) : Promise.resolve([]),
    tradeIds.length > 0 ? tradesOf(tradeIds) : Promise.resolve([]),
  ]);

  const movementsByWallet = groupByWallet(movements);
  const tradesByWallet = groupByWallet(trades);

  return {
    all,
    pinned: pinnedWallets.map((wallet) => {
      const { movements: _movements, trades: _trades, ...totals } = withContents(
        wallet,
        movementsByWallet.get(wallet.id) ?? [],
        tradesByWallet.get(wallet.id) ?? []
      );
      return totals;
    }),
  };
}

/** Movimientos de un puñado de billeteras puntuales (`in`), para el carrusel de Inicio. */
async function movementsOf(walletIds: string[]): Promise<Movement[]> {
  const snapshot = await collection(COLLECTIONS.walletMovements)
    .where("walletId", "in", walletIds)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      category: data.category,
      categoryEmoji: data.categoryEmoji,
      amount: data.amount,
      date: data.date,
      walletId: data.walletId,
    };
  });
}

/** Ídem para el libro de las carteras fijadas. */
async function tradesOf(walletIds: string[]): Promise<WalletTrade[]> {
  const snapshot = await collection(COLLECTIONS.walletTrades)
    .where("walletId", "in", walletIds)
    .get();

  return snapshot.docs.map((doc) => toTrade(doc.id, doc.data()));
}
