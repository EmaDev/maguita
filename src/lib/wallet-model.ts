import type { Movement } from "@/lib/data/home";
import type {
  AssetType,
  CurrencyCode,
  TradeKind,
  WalletColor,
  WalletKind,
} from "@/lib/firebase/collections";

/**
 * Cálculos y opciones de presentación de la mini-app **Billetera**. Funciones
 * puras, sin `"use client"` ni `"server-only"`: las comparten la validación de
 * las Server Actions y los paneles del cliente, así los dos derivan los mismos
 * números — mismo criterio que `home-model.ts` y `workout-model.ts`.
 */

export type { AssetType, CurrencyCode, TradeKind, WalletColor, WalletKind };

/**
 * Tope de billeteras por cuenta. La grilla las muestra todas juntas sin
 * paginar y cada carga de la mini-app baja también sus movimientos, así que el
 * límite es el mismo tipo de resguardo que el de 50 hábitos.
 */
export const MAX_WALLETS = 12;

export const WALLET_NAME_MAX = 40;
export const WALLET_PURPOSE_MAX = 80;

/* ------------------------------------------------------------------ *
 * Tipo de billetera
 * ------------------------------------------------------------------ */

interface WalletKindInfo {
  label: string;
  emoji: string;
  /** Bajada del chip en el composer: qué administra este tipo. */
  description: string;
  /** Cómo se llama su número principal en la UI ("Saldo", "Deuda", "Valor de la cartera"). */
  balanceLabel: string;
  /**
   * `true` = lo que lleva adentro es un **libro de operaciones**
   * (`walletTrades`), no movimientos sueltos. Es el interruptor del que cuelga
   * toda la pantalla: qué se carga, qué totales se calculan y qué se muestra.
   */
  usesPositions: boolean;
  /**
   * `true` = el saldo se lee como deuda: un consumo (movimiento negativo)
   * *aumenta* el número que se muestra, en vez de bajarlo. Sólo `credito`.
   */
  isDebt: boolean;
}

export const WALLET_KINDS: Record<WalletKind, WalletKindInfo> = {
  gastos: {
    label: "Gastos",
    emoji: "🧾",
    description: "Una bolsa de plata para el día a día: entra y sale.",
    balanceLabel: "Saldo",
    usesPositions: false,
    isDebt: false,
  },
  ahorro: {
    label: "Ahorro",
    emoji: "🐷",
    description: "Lo mismo, pero con una meta a la que querés llegar.",
    balanceLabel: "Ahorrado",
    usesPositions: false,
    isDebt: false,
  },
  credito: {
    label: "Crédito",
    emoji: "💳",
    description: "Tarjeta o préstamo: lo que gastás es lo que debés.",
    balanceLabel: "Deuda",
    usesPositions: false,
    isDebt: true,
  },
  inversion: {
    label: "Inversión",
    emoji: "📈",
    description: "Compras, ventas y efectivo sin invertir, con su rendimiento.",
    balanceLabel: "Valor de la cartera",
    usesPositions: true,
    isDebt: false,
  },
};

export const WALLET_KIND_IDS = Object.keys(WALLET_KINDS) as WalletKind[];

export const DEFAULT_WALLET_KIND: WalletKind = "gastos";

export function isWalletKind(value: string): value is WalletKind {
  return value in WALLET_KINDS;
}

/* ------------------------------------------------------------------ *
 * Moneda
 * ------------------------------------------------------------------ */

interface CurrencyInfo {
  label: string;
  /** Prefijo que se antepone al número. Nunca sale de `Intl` — ver `formatAmount`. */
  symbol: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  ARS: { label: "Peso argentino", symbol: "$" },
  USD: { label: "Dólar", symbol: "US$" },
  EUR: { label: "Euro", symbol: "€" },
  BRL: { label: "Real", symbol: "R$" },
  USDT: { label: "Tether (USDT)", symbol: "₮" },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const DEFAULT_CURRENCY: CurrencyCode = "ARS";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

/**
 * Formato de un monto en la moneda de su billetera.
 *
 * Mismo criterio que `formatMoney` (`home-model.ts`) y por el mismo motivo:
 * armado a mano sobre `toLocaleString` y **nunca** con
 * `Intl.NumberFormat(style: "currency")`, cuyo símbolo y espaciado varían entre
 * Node y el browser — y esa diferencia es un mismatch de hidratación. Lo único
 * que agrega es el prefijo por moneda y los decimales, que hacen falta para los
 * precios unitarios de una posición.
 */
export function formatAmount(amount: number, currency: CurrencyCode, decimals = 0): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const value = absolute.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${CURRENCIES[currency].symbol}${value}`;
}

/** Igual que `formatAmount` pero explicitando el `+` de lo que suma. */
export function formatSignedAmount(
  amount: number,
  currency: CurrencyCode,
  decimals = 0
): string {
  return amount > 0 ? `+${formatAmount(amount, currency, decimals)}` : formatAmount(amount, currency, decimals);
}

/**
 * Cantidad de unidades de una posición. Hasta 8 decimales (lo que necesita
 * cripto) pero **sin ceros de relleno**: "3" se ve "3", no "3,00000000".
 */
export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("es-AR", { maximumFractionDigits: 8 });
}

/** Decimales con los que se muestran los precios unitarios de una posición. */
export const PRICE_DECIMALS = 2;

/**
 * Emojis ofrecidos para una billetera. Set curado, no input libre: garantiza
 * que lo guardado sea siempre uno de estos y evita depender del teclado de
 * emoji nativo, que varía de soporte entre navegadores (mismo criterio que
 * `EmojiPicker`).
 */
export const WALLET_EMOJIS = [
  "👛", "💰", "🏦", "🐷", "🎯", "💳",
  "🏠", "🚗", "✈️", "🌴", "🎓", "🎁",
  "🛒", "🍔", "💊", "🐾", "🎮", "🧾",
  "💼", "🛠️", "👕", "📱",
] as const;

export const DEFAULT_WALLET_EMOJI = WALLET_EMOJIS[0];

interface WalletColorStyle {
  label: string;
  /** Fondo del chip del emoji. */
  soft: string;
  /** Color del saldo y del punto de color. */
  text: string;
  dot: string;
  /**
   * Tono para `ProgressBar`, que no acepta `"muted"` — esa opción cae a
   * `"primary"` en vez de sumar un tono que el tema no tiene.
   */
  progress: "primary" | "accent" | "success" | "danger";
}

/**
 * Registro de colores. Las clases están escritas literales (no armadas con
 * template strings) porque Tailwind escanea el código fuente: una clase
 * construida en runtime no llega a la hoja de estilos.
 */
export const WALLET_COLORS: Record<WalletColor, WalletColorStyle> = {
  primary: { label: "Azul", soft: "bg-primary/12", text: "text-primary", dot: "bg-primary", progress: "primary" },
  accent: { label: "Violeta", soft: "bg-accent/12", text: "text-accent", dot: "bg-accent", progress: "accent" },
  success: { label: "Verde", soft: "bg-success/12", text: "text-success", dot: "bg-success", progress: "success" },
  danger: { label: "Rojo", soft: "bg-danger/12", text: "text-danger", dot: "bg-danger", progress: "danger" },
  muted: { label: "Gris", soft: "bg-muted/12", text: "text-muted", dot: "bg-muted", progress: "primary" },
};

export const WALLET_COLOR_IDS = Object.keys(WALLET_COLORS) as WalletColor[];

export const DEFAULT_WALLET_COLOR: WalletColor = "primary";

/** Estrecha un `string` que viene del cliente (o de un documento viejo) a `WalletColor`. */
export function isWalletColor(value: string): value is WalletColor {
  return value in WALLET_COLORS;
}

export interface WalletTotals {
  /** Total ingresado, en positivo. */
  income: number;
  /** Total gastado, en positivo. */
  spent: number;
  /** `initialBalance + income − spent`. Puede ser negativo. */
  balance: number;
  movementCount: number;
}

/**
 * Saldo y totales de una billetera a partir de sus movimientos. Igual que
 * `expenseCycleProgress`, el saldo se deriva en cada lectura en vez de
 * guardarse como campo del documento: un acumulado habría que mantenerlo
 * sincronizado en cada alta y en cada baja, y se desincroniza en el primer
 * error a mitad de camino.
 */
export function walletTotals(initialBalance: number, movements: Movement[]): WalletTotals {
  let income = 0;
  let spent = 0;
  for (const movement of movements) {
    if (movement.amount >= 0) income += movement.amount;
    else spent += -movement.amount;
  }
  return {
    income,
    spent,
    balance: initialBalance + income - spent,
    movementCount: movements.length,
  };
}

/**
 * Progreso hacia la meta de la billetera, en 0–100 y saturado. `null` cuando
 * no tiene meta (`targetAmount`): la card no dibuja la barra en ese caso.
 */
export function walletTargetProgress(targetAmount: number | null, balance: number): number | null {
  if (!targetAmount || targetAmount <= 0) return null;
  return Math.max(0, Math.min(100, (balance / targetAmount) * 100));
}

/* ------------------------------------------------------------------ *
 * Inversión
 * ------------------------------------------------------------------ */

interface AssetTypeInfo {
  label: string;
  emoji: string;
}

export const ASSET_TYPES: Record<AssetType, AssetTypeInfo> = {
  accion: { label: "Acción", emoji: "📊" },
  cedear: { label: "CEDEAR", emoji: "🌎" },
  cripto: { label: "Cripto", emoji: "🪙" },
  fondo: { label: "Fondo", emoji: "🧺" },
  bono: { label: "Bono", emoji: "📜" },
  "plazo-fijo": { label: "Plazo fijo", emoji: "🔒" },
  otro: { label: "Otro", emoji: "✨" },
};

export const ASSET_TYPE_IDS = Object.keys(ASSET_TYPES) as AssetType[];

export const DEFAULT_ASSET_TYPE: AssetType = "accion";

export function isAssetType(value: string): value is AssetType {
  return value in ASSET_TYPES;
}

export const ASSET_SYMBOL_MAX = 20;
export const ASSET_NAME_MAX = 60;
export const TRADE_NOTE_MAX = 140;


/** Tope de asientos por cartera, mismo criterio de resguardo que `MAX_WALLETS`. */
export const MAX_TRADES_PER_WALLET = 500;

interface TradeKindInfo {
  label: string;
  emoji: string;
  /** Qué toca la operación, que es lo que decide qué campos pide y valida. */
  movesAsset: boolean;
  /** Signo con el que impacta en el efectivo: `1` entra, `-1` sale. */
  cashSign: 1 | -1;
}

export const TRADE_KINDS: Record<TradeKind, TradeKindInfo> = {
  deposito: { label: "Depósito", emoji: "⬇️", movesAsset: false, cashSign: 1 },
  retiro: { label: "Retiro", emoji: "⬆️", movesAsset: false, cashSign: -1 },
  compra: { label: "Compra", emoji: "🛒", movesAsset: true, cashSign: -1 },
  venta: { label: "Venta", emoji: "💸", movesAsset: true, cashSign: 1 },
  dividendo: { label: "Dividendo", emoji: "🎁", movesAsset: false, cashSign: 1 },
  comision: { label: "Comisión", emoji: "✂️", movesAsset: false, cashSign: -1 },
};

export const TRADE_KIND_IDS = Object.keys(TRADE_KINDS) as TradeKind[];

export function isTradeKind(value: string): value is TradeKind {
  return value in TRADE_KINDS;
}

/** Un asiento del libro, con lo mínimo que necesita el fold de abajo. */
export interface TradeEntry {
  id: string;
  kind: TradeKind;
  date: string;
  assetSymbol: string | null;
  assetName: string | null;
  assetType: AssetType | null;
  quantity: number | null;
  unitPrice: number | null;
  cashAmount: number;
  /** Milisegundos de `createdAt`, sólo para desempatar dos asientos del mismo día. */
  createdAt: number;
}

/**
 * Orden en el que se recorre el libro: por día, y a igual día por orden de
 * carga (y el id como último desempate, para que el resultado sea idéntico en
 * el server y en el cliente aunque dos asientos compartan milisegundo).
 *
 * **El orden importa de verdad**, no es cosmético: el costo promedio de una
 * tenencia y el resultado de cada venta dependen de qué había comprado antes.
 * Recorrer el mismo libro en otro orden da otros números.
 */
export function byTradeOrder(a: TradeEntry, b: TradeEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** La tenencia de un activo, **derivada** del libro. No se guarda en ningún lado. */
export interface Holding {
  assetSymbol: string;
  assetName: string;
  assetType: AssetType;
  /** Unidades en cartera hoy: compradas − vendidas. */
  quantity: number;
  /** Lo que costó lo que todavía está en cartera (costo promedio ponderado × cantidad). */
  costBasis: number;
  /** `costBasis / quantity`. `0` si ya no queda nada. */
  avgUnitPrice: number;
  /** Última cotización conocida. `null` = sin precio cargado. */
  currentPrice: number | null;
  /** `quantity × currentPrice`. Cae a `costBasis` si no hay precio. */
  value: number;
  /** Lo que ganaría/perdería si vendiera hoy. */
  unrealizedGain: number;
  unrealizedGainPct: number | null;
  /** Lo ya ganado/perdido en las ventas hechas de este activo. Sobrevive aunque la tenencia quede en cero. */
  realizedGain: number;
  /** `false` = sin cotización: `value` es el costo y `unrealizedGain` es cero. */
  priced: boolean;
  /** Fecha del primer asiento de este activo — su "fecha de ingreso". */
  firstEntryDate: string;
  tradeCount: number;
  /**
   * `true` = el libro pide vender más unidades de las que había en ese
   * momento. Pasa al borrar una compra vieja dejando su venta colgada; la
   * cantidad se clampea en cero y la UI avisa en vez de mostrar un negativo.
   */
  inconsistent: boolean;
}

export interface Portfolio {
  /** **Efectivo sin invertir**: la suma de la columna `cashAmount` del libro entero. */
  cash: number;
  /** Tenencias con unidades hoy, de mayor a menor valor. */
  holdings: Holding[];
  /** Tenencias que ya se vendieron del todo, con su resultado realizado. */
  closed: Holding[];
  /** Costo de lo que hoy está invertido. */
  invested: number;
  /** Valor de mercado de lo invertido. */
  marketValue: number;
  /** `cash + marketValue`: lo que vale la cartera entera. */
  totalValue: number;
  /** Depósitos − retiros: la plata que el usuario efectivamente puso. */
  netContributed: number;
  unrealizedGain: number;
  /** Resultado ya realizado en ventas, más dividendos, menos comisiones. */
  realizedGain: number;
  /** `unrealizedGain + realizedGain`. */
  totalGain: number;
  /** El resultado total contra lo aportado. `null` si todavía no aportó nada. */
  totalGainPct: number | null;
  /** Cuántas tenencias abiertas tienen cotización, sobre el total. */
  pricedCount: number;
  /** `true` = alguna tenencia quedó inconsistente (ver `Holding.inconsistent`). */
  hasInconsistencies: boolean;
}

interface HoldingAccumulator extends Holding {
  /** Se descarta al cerrar: sólo sirve para ordenar. */
  sortKey: number;
}

/**
 * Reconstruye una cartera entera —efectivo sin invertir, tenencias y
 * resultado— recorriendo su libro de operaciones en orden.
 *
 * **Nada de esto está guardado**: cada número que devuelve sale de sumar
 * asientos, así que no puede desincronizarse de su detalle. Borrar una
 * operación recalcula todo solo, sin ningún campo que quede viejo.
 *
 * El costo de lo que queda en cartera se lleva por **costo promedio
 * ponderado**: cada compra promedia su precio con lo que ya había, y cada
 * venta saca unidades a ese promedio. Es el criterio estándar y el único que
 * no obliga a guardar de qué compra puntual salió cada unidad vendida (FIFO),
 * que exigiría un modelo de lotes que este libro deliberadamente no tiene.
 *
 * Es una función pura y vive acá para que la usen igual la pantalla y las
 * Server Actions — la validación de "no podés vender más de lo que tenés" sale
 * de este mismo cálculo, así que el server y el cliente nunca discrepan.
 */
export function portfolio(trades: TradeEntry[], quotes: Record<string, number>): Portfolio {
  const ordered = [...trades].sort(byTradeOrder);
  const byAsset = new Map<string, HoldingAccumulator>();

  let cash = 0;
  let netContributed = 0;
  let realizedFromCash = 0;

  for (const trade of ordered) {
    cash += trade.cashAmount;

    if (trade.kind === "deposito" || trade.kind === "retiro") {
      netContributed += trade.cashAmount;
      continue;
    }
    // Dividendos y comisiones no son aportes ni tocan la tenencia: son
    // resultado puro, y ya movieron el efectivo en la línea de arriba.
    if (trade.kind === "dividendo" || trade.kind === "comision") {
      realizedFromCash += trade.cashAmount;
      continue;
    }

    const symbol = trade.assetSymbol;
    if (!symbol || trade.quantity === null || trade.unitPrice === null) continue;

    const holding = byAsset.get(symbol) ?? newHolding(trade, symbol);
    holding.tradeCount += 1;
    // El nombre y el tipo se toman del asiento más reciente: si el usuario los
    // corrige al cargar una compra nueva, la tenencia queda con el corregido.
    holding.assetName = trade.assetName || holding.assetName;
    holding.assetType = trade.assetType ?? holding.assetType;

    if (trade.kind === "compra") {
      holding.quantity += trade.quantity;
      // El costo que se acumula es el de la operación (`-cashAmount`), no
      // `quantity × unitPrice`: si el asiento incluyó una comisión en el
      // importe, esa comisión es parte de lo que costó la tenencia.
      holding.costBasis += -trade.cashAmount;
    } else {
      // Venta: salen unidades al costo promedio, y la diferencia contra lo que
      // entró de efectivo es el resultado realizado. Clampeado para que un
      // libro incompleto no genere cantidades negativas.
      const sold = Math.min(trade.quantity, holding.quantity);
      if (sold < trade.quantity) holding.inconsistent = true;

      const avg = holding.quantity > 0 ? holding.costBasis / holding.quantity : 0;
      const costOfSold = avg * sold;
      holding.quantity -= sold;
      holding.costBasis -= costOfSold;
      holding.realizedGain += trade.cashAmount - costOfSold;
    }

    byAsset.set(symbol, holding);
  }

  const holdings: Holding[] = [];
  const closed: Holding[] = [];

  for (const holding of byAsset.values()) {
    const price = quotes[holding.assetSymbol] ?? null;
    const priced = price !== null && holding.quantity > 0;

    holding.currentPrice = price;
    holding.priced = priced;
    holding.value = priced ? holding.quantity * price : holding.costBasis;
    holding.unrealizedGain = priced ? holding.value - holding.costBasis : 0;
    holding.unrealizedGainPct =
      priced && holding.costBasis > 0 ? (holding.unrealizedGain / holding.costBasis) * 100 : null;
    holding.avgUnitPrice = holding.quantity > 0 ? holding.costBasis / holding.quantity : 0;

    const { sortKey: _sortKey, ...clean } = holding;
    // Una tenencia en cero no desaparece del todo: pasa a "cerradas", donde
    // sigue mostrando lo que se ganó o perdió con ella. Borrarla de la vista
    // escondería justamente el resultado que el usuario quiere ver.
    if (holding.quantity > 0) holdings.push(clean);
    else closed.push(clean);
  }

  holdings.sort((a, b) => b.value - a.value);
  closed.sort((a, b) => (a.firstEntryDate < b.firstEntryDate ? 1 : -1));

  const invested = holdings.reduce((total, holding) => total + holding.costBasis, 0);
  const marketValue = holdings.reduce((total, holding) => total + holding.value, 0);
  const unrealizedGain = holdings.reduce((total, holding) => total + holding.unrealizedGain, 0);
  const realizedGain =
    [...holdings, ...closed].reduce((total, holding) => total + holding.realizedGain, 0) +
    realizedFromCash;
  const totalGain = unrealizedGain + realizedGain;

  return {
    cash,
    holdings,
    closed,
    invested,
    marketValue,
    totalValue: cash + marketValue,
    netContributed,
    unrealizedGain,
    realizedGain,
    totalGain,
    totalGainPct: netContributed > 0 ? (totalGain / netContributed) * 100 : null,
    pricedCount: holdings.filter((holding) => holding.priced).length,
    hasInconsistencies: [...holdings, ...closed].some((holding) => holding.inconsistent),
  };
}

function newHolding(trade: TradeEntry, symbol: string): HoldingAccumulator {
  return {
    assetSymbol: symbol,
    assetName: trade.assetName || symbol,
    assetType: trade.assetType ?? DEFAULT_ASSET_TYPE,
    quantity: 0,
    costBasis: 0,
    avgUnitPrice: 0,
    currentPrice: null,
    value: 0,
    unrealizedGain: 0,
    unrealizedGainPct: null,
    realizedGain: 0,
    priced: false,
    firstEntryDate: trade.date,
    tradeCount: 0,
    inconsistent: false,
    sortKey: 0,
  };
}

/**
 * Cuántas unidades de un activo hay en cartera según el libro. Es lo que usa
 * `recordTradeAction` para rechazar una venta mayor a la tenencia — sale del
 * mismo `portfolio()` que muestra la pantalla, así que el tope que valida el
 * server es exactamente el que el usuario ve.
 */
export function heldQuantity(
  trades: TradeEntry[],
  quotes: Record<string, number>,
  assetSymbol: string
): number {
  const holding = portfolio(trades, quotes).holdings.find(
    (item) => item.assetSymbol === assetSymbol
  );
  return holding?.quantity ?? 0;
}

/** Rendimiento en porcentaje, ya formateado con su signo. `—` si no hay cotización. */
export function formatGainPct(gainPct: number | null): string {
  if (gainPct === null) return "—";
  const rounded = Math.round(gainPct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

/* ------------------------------------------------------------------ *
 * El número principal de una billetera, ya resuelto por tipo
 * ------------------------------------------------------------------ */

export interface WalletHeadline {
  /** "Saldo" / "Deuda" / "Valor de la cartera", según el tipo. */
  label: string;
  /** El número a mostrar, **ya con el signo que corresponde a su lectura**. */
  amount: number;
  /** `true` = pintarlo en rojo: saldo negativo, o deuda mayor a cero. */
  negative: boolean;
  /** Con cuántos decimales mostrarlo: una cartera opera con fracciones, una bolsa de gastos no. */
  decimals: number;
}

/**
 * Qué número muestra la card de una billetera, y con qué nombre.
 *
 * Vive acá y no en cada componente porque lo necesitan tres pantallas (la
 * grilla de la mini-app, su detalle y el carrusel de Inicio) y las tres tienen
 * que decir exactamente lo mismo. La lectura por tipo es la que define el
 * registro `WALLET_KINDS`:
 *
 * - `credito` invierte el signo: un consumo deja el saldo en −5000, y lo que
 *   el usuario tiene que leer es "Deuda: $5.000" — un "−$5.000" bajo la
 *   etiqueta "Deuda" se entendería como que le deben a él.
 * - `inversion` no usa el saldo de movimientos sino el valor total de la
 *   cartera: sus tenencias **más el efectivo sin invertir**. Dejar la caja
 *   afuera haría que vender todo pareciera perder la plata.
 */
export function walletHeadline(
  kind: WalletKind,
  totals: WalletTotals,
  investment: Portfolio | null
): WalletHeadline {
  const info = WALLET_KINDS[kind];

  if (info.usesPositions) {
    const value = investment?.totalValue ?? 0;
    return {
      label: info.balanceLabel,
      amount: value,
      negative: value < 0,
      decimals: PRICE_DECIMALS,
    };
  }

  if (info.isDebt) {
    const debt = -totals.balance;
    return { label: info.balanceLabel, amount: debt, negative: debt > 0, decimals: 0 };
  }

  return {
    label: info.balanceLabel,
    amount: totals.balance,
    negative: totals.balance < 0,
    decimals: 0,
  };
}

/**
 * Progreso de la barra de una billetera, ya resuelto por tipo: la meta en
 * `gastos`/`ahorro`, y cuánto del límite lleva consumido en `credito`. `null`
 * = no dibuja barra (no tiene meta/límite, o es de inversión).
 */
export function walletProgress(
  kind: WalletKind,
  wallet: { targetAmount: number | null; creditLimit: number | null },
  totals: WalletTotals
): WalletProgress | null {
  if (WALLET_KINDS[kind].isDebt) {
    if (!wallet.creditLimit || wallet.creditLimit <= 0) return null;
    const used = Math.max(0, -totals.balance);
    return {
      pct: Math.min(100, (used / wallet.creditLimit) * 100),
      label: "Límite",
      total: wallet.creditLimit,
      over: used > wallet.creditLimit,
    };
  }

  if (WALLET_KINDS[kind].usesPositions) return null;

  const pct = walletTargetProgress(wallet.targetAmount, totals.balance);
  return pct === null || wallet.targetAmount === null
    ? null
    : { pct, label: "Meta", total: wallet.targetAmount, over: false };
}

export interface WalletProgress {
  /** 0–100, saturado. */
  pct: number;
  /** "Meta" o "Límite", según el tipo. */
  label: string;
  /**
   * El monto contra el que se mide (la meta o el límite), ya elegido acá. Lo
   * devuelve la función en vez de dejar que cada card lo deduzca del `label`:
   * decidir qué campo mostrar comparando un texto de UI se rompe en silencio
   * la primera vez que alguien cambia esa palabra.
   */
  total: number;
  over: boolean;
}
