"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  collection,
  now,
  type AssetType,
  type CurrencyCode,
  type WalletColor,
  type WalletDoc,
  type WalletKind,
} from "@/lib/firebase/collections";
import {
  ASSET_NAME_MAX,
  ASSET_SYMBOL_MAX,
  DEFAULT_ASSET_TYPE,
  DEFAULT_CURRENCY,
  DEFAULT_WALLET_COLOR,
  DEFAULT_WALLET_EMOJI,
  DEFAULT_WALLET_KIND,
  formatQuantity,
  heldQuantity,
  isAssetType,
  isCurrencyCode,
  isTradeKind,
  isWalletColor,
  isWalletKind,
  MAX_TRADES_PER_WALLET,
  MAX_WALLETS,
  TRADE_KINDS,
  TRADE_NOTE_MAX,
  WALLET_EMOJIS,
  WALLET_KINDS,
  WALLET_NAME_MAX,
  WALLET_PURPOSE_MAX,
  type TradeEntry,
} from "@/lib/wallet-model";
import { DEFAULT_EXPENSE_CATEGORIES } from "./expense-categories";

/**
 * Altas/bajas de la mini-app Billetera. Todas re-verifican la sesión porque
 * una Server Action es un endpoint público, y **además** el dueño de cada
 * documento: el Admin SDK saltea las reglas de Firestore, así que ese chequeo
 * es la única barrera real contra que una sesión válida toque la billetera de
 * otra cuenta pasando su id (mismo criterio que `getOwnedActiveCycle` en
 * `expenses-actions.ts`).
 */

/**
 * Las dos pantallas que muestran billeteras: la mini-app y el carrusel de
 * accesos directos de Inicio. Cualquier escritura sobre una billetera, sus
 * movimientos o sus posiciones desactualiza a las dos —el carrusel muestra
 * nombre, color y saldo—, así que todas las acciones de este archivo revalidan
 * las dos rutas en vez de que cada una elija cuál le corresponde.
 */
function revalidateWalletScreens(): void {
  revalidatePath(ROUTES.miniAppBilletera);
  revalidatePath(ROUTES.inicio);
}

/** Trae la billetera y valida que sea de la cuenta que la pide. */
async function getOwnedWallet(walletId: string, ownerId: string): Promise<WalletDoc> {
  const snapshot = await collection(COLLECTIONS.wallets).doc(walletId).get();
  const wallet = snapshot.data();
  if (!wallet || wallet.ownerId !== ownerId) {
    throw new Error("Esa billetera no existe.");
  }
  return wallet;
}

/**
 * Valida los campos que comparten el alta y la edición y los devuelve
 * normalizados, para que las dos escriban exactamente lo mismo.
 *
 * `kind` es un parámetro aparte y no sale de `input`: en el alta lo elige el
 * usuario, pero en la edición **no se puede cambiar** (ver
 * `updateWalletAction`), así que ahí lo manda el caller con el valor que ya
 * tiene guardado la billetera. Es lo que hace que los campos que dependen del
 * tipo (`targetAmount`, `creditLimit`, `initialBalance`) se validen siempre
 * contra el tipo real y no contra el que diga el cliente.
 */
function normalizeWalletFields(input: WalletFields, kind: WalletKind) {
  const name = input.name.trim();
  if (!name) throw new Error("Ponele un nombre a la billetera.");
  if (name.length > WALLET_NAME_MAX) {
    throw new Error(`El nombre no puede superar los ${WALLET_NAME_MAX} caracteres.`);
  }

  const purpose = input.purpose?.trim() || null;
  if (purpose && purpose.length > WALLET_PURPOSE_MAX) {
    throw new Error(`La descripción no puede superar los ${WALLET_PURPOSE_MAX} caracteres.`);
  }

  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    throw new Error("El saldo inicial no es válido.");
  }

  const kindInfo = WALLET_KINDS[kind];

  // Los campos que no aplican al tipo se guardan en su valor neutro en vez de
  // lo que haya mandado el cliente: una billetera de inversión no lleva
  // movimientos, así que un `initialBalance` ahí sería un número que la
  // pantalla nunca muestra pero que igual entra en cuentas si alguien lo lee.
  const initialBalance = kindInfo.usesPositions ? 0 : input.initialBalance;

  const targetAmount =
    kindInfo.usesPositions || kindInfo.isDebt ? null : (input.targetAmount ?? null);
  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0)) {
    throw new Error("La meta no es válida.");
  }

  const creditLimit = kindInfo.isDebt ? (input.creditLimit ?? null) : null;
  if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit <= 0)) {
    throw new Error("El límite no es válido.");
  }

  // El emoji y el color se estrechan contra sus registros en vez de guardarse
  // tal cual llegan: el cliente los elige de una paleta fija, así que un valor
  // fuera de ella sólo puede venir de un request armado a mano.
  const emoji = (WALLET_EMOJIS as readonly string[]).includes(input.emoji)
    ? input.emoji
    : DEFAULT_WALLET_EMOJI;
  const color: WalletColor = isWalletColor(input.color) ? input.color : DEFAULT_WALLET_COLOR;

  return { name, purpose, emoji, color, initialBalance, targetAmount, creditLimit };
}

export interface WalletFields {
  name: string;
  emoji: string;
  color: string;
  /** Vacío/ausente = sin bajada. */
  purpose?: string;
  initialBalance: number;
  /** `null` = sin meta de ahorro. Se ignora en crédito e inversión. */
  targetAmount?: number | null;
  /** `null` = sin límite. Se ignora en todo lo que no sea crédito. */
  creditLimit?: number | null;
}

export interface AddWalletInput extends WalletFields {
  /** Se elige **sólo acá**: después de creada la billetera no se puede cambiar. */
  kind: string;
  /** Ídem: la moneda queda fija desde el alta. */
  currency: string;
}

/**
 * Crea una billetera. El tope de `MAX_WALLETS` se chequea con un `count()` en
 * vez de traerse la colección entera: sólo hace falta el número.
 */
export async function addWalletAction(input: AddWalletInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const kind: WalletKind = isWalletKind(input.kind) ? input.kind : DEFAULT_WALLET_KIND;
  const currency: CurrencyCode = isCurrencyCode(input.currency)
    ? input.currency
    : DEFAULT_CURRENCY;
  const fields = normalizeWalletFields(input, kind);

  const wallets = collection(COLLECTIONS.wallets);
  const existing = await wallets.where("ownerId", "==", session.sub).count().get();
  if (existing.data().count >= MAX_WALLETS) {
    throw new Error(`Llegaste al máximo de ${MAX_WALLETS} billeteras.`);
  }

  const timestamp = now();
  await wallets.add({
    ownerId: session.sub,
    kind,
    currency,
    ...fields,
    // Una billetera nueva no se fija sola en Inicio: el carrusel es una
    // selección explícita del usuario, no "todas las que tenga".
    pinnedToHome: false,
    quotes: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  revalidateWalletScreens();
}

export interface UpdateWalletInput extends WalletFields {
  walletId: string;
}

/**
 * Edita una billetera. Reemplaza todos los campos editables a la vez (no hay
 * `PATCH` parcial, mismo criterio que `updateNoteAction`) y no toca
 * `createdAt`, que es lo que ordena la grilla.
 *
 * **`kind` y `currency` no están entre los campos editables**, ni siquiera si
 * el cliente los manda: `normalizeWalletFields` se valida contra el `kind` que
 * ya tiene guardado el documento y el `update` no los incluye. Cambiar el tipo
 * dejaría movimientos en una billetera que pasó a llevar posiciones (o al
 * revés) y resignificaría su saldo; cambiar la moneda reinterpretaría en otra
 * unidad montos que se cargaron en la vieja, que sin una cotización es inventar
 * números. Para cambiar cualquiera de las dos hay que crear otra billetera.
 *
 * `initialBalance` **sí** se puede editar, a diferencia del saldo inicial de un
 * `expenseCycle`: una billetera no es un período cerrado contra el que se midan
 * los gastos ya cargados, es una bolsa viva cuyo punto de partida el usuario
 * puede haber cargado mal.
 */
export async function updateWalletAction(input: UpdateWalletInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const wallet = await getOwnedWallet(input.walletId, session.sub);
  const kind: WalletKind = isWalletKind(wallet.kind ?? "") ? wallet.kind : DEFAULT_WALLET_KIND;
  const fields = normalizeWalletFields(input, kind);

  await collection(COLLECTIONS.wallets).doc(input.walletId).update({
    ...fields,
    updatedAt: now(),
  });

  revalidateWalletScreens();
}

/**
 * Fija o saca una billetera del carrusel de accesos directos de Inicio.
 *
 * Escribe un solo campo de un solo documento (no un array con la selección
 * entera): así prender una billetera desde el celular y otra desde la compu no
 * se pisan entre sí, que es justo lo que pasaría con un read-modify-write
 * sobre una lista.
 *
 * Revalida **las dos** rutas: el toggle se puede tocar tanto desde el detalle
 * de la billetera en la mini-app como desde el propio selector de Inicio, y en
 * los dos casos las dos pantallas quedan desactualizadas.
 */
export async function toggleWalletHomePinAction(
  walletId: string,
  pinned: boolean
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);
  await getOwnedWallet(walletId, session.sub);

  await collection(COLLECTIONS.wallets).doc(walletId).update({
    pinnedToHome: pinned,
    updatedAt: now(),
  });

  revalidateWalletScreens();
}

/** Tope de un `WriteBatch` de Firestore. */
const DELETE_BATCH_SIZE = 500;

/**
 * Borra una billetera **y sus movimientos**: sin esto quedarían documentos de
 * `walletMovements` apuntando a un `walletId` que ya no existe, invisibles en
 * la UI pero contando en cada lectura de la mini-app (`getWalletMovements`
 * consulta por `ownerId`, no por billetera).
 *
 * Va en tandas de `DELETE_BATCH_SIZE` —el tope de un batch— repitiendo hasta
 * vaciar, igual que `deleteOwnedDocs` en `module-reset-actions.ts`: por UI es
 * difícil llegar a 500 movimientos en una billetera, pero nada lo impide.
 */
export async function deleteWalletAction(walletId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);
  await getOwnedWallet(walletId, session.sub);

  // Las dos colecciones hijas, no sólo la que corresponde al tipo: el tipo no
  // se puede cambiar, pero borrar por tipo dejaría huérfano cualquier
  // documento que hubiera quedado de una versión anterior de los datos, que es
  // exactamente lo que este borrado en cascada existe para evitar.
  await deleteChildDocs(COLLECTIONS.walletMovements, walletId);
  await deleteChildDocs(COLLECTIONS.walletTrades, walletId);

  await collection(COLLECTIONS.wallets).doc(walletId).delete();

  revalidateWalletScreens();
}

/** Borra en tandas todo lo que cuelgue de una billetera en `name`. */
async function deleteChildDocs(
  name: typeof COLLECTIONS.walletMovements | typeof COLLECTIONS.walletTrades,
  walletId: string
): Promise<void> {
  const ref = collection(name);
  for (;;) {
    const snapshot = await ref.where("walletId", "==", walletId).limit(DELETE_BATCH_SIZE).get();
    if (snapshot.empty) return;

    const batch = adminDb().batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();

    if (snapshot.size < DELETE_BATCH_SIZE) return;
  }
}

/** Categoría fija de los ingresos, igual que en `expenses-actions.ts`: no pasan por el ABM. */
const INCOME_CATEGORY = { name: "Ingreso", emoji: "💰" } as const;

export interface AddWalletMovementInput {
  walletId: string;
  /** Vacío = se completa con el nombre de la categoría (o "Ingreso"). */
  title: string;
  amount: number;
  date: string;
  /**
   * Id de una categoría del ABM del usuario (`expenseCategories/{uid}`) —
   * el mismo ABM que usa el gestor de gastos de Inicio, no uno propio de las
   * billeteras. Sólo para gastos: un ingreso usa `INCOME_CATEGORY`.
   */
  categoryId?: string;
  /** `"expense"` guarda el monto en negativo; `"income"`, en positivo. */
  kind: "expense" | "income";
}

/**
 * Carga un movimiento en una billetera. El monto se manda siempre positivo y
 * el signo lo decide `kind` acá en el server (ver `Movement.amount`).
 *
 * Es un alta única para gasto e ingreso, a diferencia del gestor de gastos
 * —que tiene `addExpenseMovementAction` y `addExpenseIncomeAction` por
 * separado— porque acá los dos escriben exactamente el mismo documento: no hay
 * ciclo activo que validar ni umbral de tope que avisar, la única diferencia
 * es el signo y de dónde sale la categoría.
 */
export async function addWalletMovementAction(input: AddWalletMovementInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const amount = Math.abs(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Revisá el monto del movimiento.");
  }
  if (!input.date) throw new Error("Revisá la fecha del movimiento.");

  const wallet = await getOwnedWallet(input.walletId, session.sub);
  // Una billetera de inversión no lleva movimientos sino posiciones. La UI ni
  // siquiera ofrece los botones, pero una Server Action es un endpoint
  // público: sin este chequeo se le podrían cargar movimientos que después
  // ninguna pantalla mostraría y que tampoco entrarían en sus totales.
  if (WALLET_KINDS[isWalletKind(wallet.kind ?? "") ? wallet.kind : DEFAULT_WALLET_KIND].usesPositions) {
    throw new Error("Una billetera de inversión se carga con posiciones, no con movimientos.");
  }

  let category: string = INCOME_CATEGORY.name;
  let categoryEmoji: string = INCOME_CATEGORY.emoji;

  if (input.kind === "expense") {
    // El nombre y el emoji se resuelven acá (no se confía en lo que mande el
    // cliente) y quedan copiados en el movimiento: si la categoría se edita o
    // se borra después, este gasto sigue mostrando lo que mostraba al
    // cargarse. Mismo criterio que `addExpenseMovementAction`.
    const categoriesSnapshot = await collection(COLLECTIONS.expenseCategories)
      .doc(session.sub)
      .get();
    const categories = categoriesSnapshot.data()?.categories ?? DEFAULT_EXPENSE_CATEGORIES;
    const found = categories.find((item) => item.id === input.categoryId);
    if (!found) throw new Error("Elegí una categoría válida.");
    category = found.name;
    categoryEmoji = found.emoji;
  }

  await collection(COLLECTIONS.walletMovements).add({
    walletId: input.walletId,
    ownerId: session.sub,
    title: input.title.trim() || category,
    category,
    categoryEmoji,
    amount: input.kind === "expense" ? -amount : amount,
    date: input.date,
    createdAt: now(),
  });

  revalidateWalletScreens();
}

/**
 * Borra un movimiento de una billetera. Valida el dueño del propio movimiento
 * (que tiene `ownerId` duplicado justamente para esto) en vez de ir a buscar
 * su billetera: un `get()` menos, y el mismo resultado.
 */
export async function deleteWalletMovementAction(movementId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const ref = collection(COLLECTIONS.walletMovements).doc(movementId);
  const snapshot = await ref.get();
  const movement = snapshot.data();
  if (!movement || movement.ownerId !== session.sub) {
    throw new Error("Ese movimiento no existe.");
  }

  await ref.delete();

  revalidateWalletScreens();
}

/* ------------------------------------------------------------------ *
 * Libro de operaciones (billeteras de inversión)
 * ------------------------------------------------------------------ */

export interface RecordTradeInput {
  walletId: string;
  kind: string;
  /** Día de la operación, `yyyy-mm-dd`. */
  date: string;
  /** Sólo en compra/venta/dividendo. */
  assetSymbol?: string;
  assetName?: string;
  assetType?: string;
  /** Unidades, siempre positivo. Sólo en compra/venta. */
  quantity?: number;
  /** Precio por unidad. Sólo en compra/venta. */
  unitPrice?: number;
  /**
   * Importe que mueve el efectivo, **siempre positivo**: el signo lo pone el
   * server según el tipo de operación. En depósito/retiro/dividendo/comisión
   * es el monto; en compra/venta es opcional y por defecto sale de
   * `quantity × unitPrice`.
   */
  amount?: number;
  note?: string;
}

/**
 * Asienta una operación en el libro de una cartera: depósito, retiro, compra,
 * venta, dividendo o comisión.
 *
 * Es **una sola acción para las seis** porque todas escriben el mismo
 * documento y la diferencia está en qué campos exige cada una — que es
 * exactamente lo que dice el registro `TRADE_KINDS` (`movesAsset`, `cashSign`).
 * Separarlas sería repetir seis veces la misma validación de sesión, dueño y
 * tipo de billetera para que la única diferencia fuera un literal.
 *
 * La venta es el caso que le da sentido al modelo: descuenta unidades de la
 * tenencia y **el importe queda como efectivo sin invertir en la misma
 * billetera**, disponible para otra compra o para retirar. No hay que
 * "acreditarlo" en ningún lado — el efectivo *es* la suma de la columna
 * `cashAmount` del libro, así que aparece con sólo asentar la venta.
 */
export async function recordTradeAction(input: RecordTradeInput): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const wallet = await getOwnedWallet(input.walletId, session.sub);
  const walletKind: WalletKind = isWalletKind(wallet.kind ?? "")
    ? wallet.kind
    : DEFAULT_WALLET_KIND;
  if (!WALLET_KINDS[walletKind].usesPositions) {
    throw new Error("Sólo una billetera de inversión lleva un libro de operaciones.");
  }

  if (!isTradeKind(input.kind)) throw new Error("Esa operación no existe.");
  const kind = input.kind;
  const kindInfo = TRADE_KINDS[kind];

  assertValidDay(input.date);

  const note = input.note?.trim() || null;
  if (note && note.length > TRADE_NOTE_MAX) {
    throw new Error(`La nota no puede superar los ${TRADE_NOTE_MAX} caracteres.`);
  }

  const trades = collection(COLLECTIONS.walletTrades);
  const existing = await trades.where("walletId", "==", input.walletId).count().get();
  if (existing.data().count >= MAX_TRADES_PER_WALLET) {
    throw new Error(`Llegaste al máximo de ${MAX_TRADES_PER_WALLET} operaciones.`);
  }

  const asset = kindInfo.movesAsset || kind === "dividendo" ? normalizeAsset(input) : null;
  let quantity: number | null = null;
  let unitPrice: number | null = null;
  let amount: number;

  if (kindInfo.movesAsset) {
    quantity = requirePositive(input.quantity, "La cantidad no es válida.");
    unitPrice = requirePositive(input.unitPrice, "El precio no es válido.");
    // El importe por defecto es el teórico, pero se puede pisar para incluir
    // la comisión del broker en la misma operación (ver `cashAmount`).
    amount = input.amount
      ? requirePositive(input.amount, "El importe no es válido.")
      : quantity * unitPrice;

    if (kind === "venta") {
      // No se puede vender lo que no se tiene. El tope sale del **mismo**
      // `portfolio()` que dibuja la pantalla, así que lo que valida el server
      // es exactamente lo que el usuario ve como disponible — y no de un
      // contador guardado que podría haber quedado viejo.
      const held = heldQuantity(await tradesOfWallet(input.walletId), {}, asset!.assetSymbol);
      if (quantity > held + QUANTITY_EPSILON) {
        throw new Error(
          `Sólo tenés ${formatQuantity(held)} ${asset!.assetSymbol} en esta cartera.`
        );
      }
    }
  } else {
    amount = requirePositive(input.amount, "El importe no es válido.");
  }

  await trades.add({
    walletId: input.walletId,
    ownerId: session.sub,
    kind,
    date: input.date,
    assetSymbol: asset?.assetSymbol ?? null,
    assetName: asset?.assetName ?? null,
    assetType: asset?.assetType ?? null,
    quantity,
    unitPrice,
    cashAmount: amount * kindInfo.cashSign,
    note,
    createdAt: now(),
  });

  revalidateWalletScreens();
}

/**
 * Margen para comparar cantidades. Multiplicar decimales en punto flotante
 * deja restos del orden de 1e-15 (`0.1 + 0.2 !== 0.3`), y sin esta tolerancia
 * vender "todo" lo que la pantalla muestra como disponible podría rebotar por
 * una millonésima de unidad.
 */
const QUANTITY_EPSILON = 1e-9;

/** Los asientos de una cartera, para validar una venta contra la tenencia real. */
async function tradesOfWallet(walletId: string): Promise<TradeEntry[]> {
  const snapshot = await collection(COLLECTIONS.walletTrades)
    .where("walletId", "==", walletId)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kind: isTradeKind(data.kind ?? "") ? data.kind : "deposito",
      date: data.date,
      assetSymbol: data.assetSymbol ?? null,
      assetName: data.assetName ?? null,
      assetType: data.assetType && isAssetType(data.assetType) ? data.assetType : null,
      quantity: data.quantity ?? null,
      unitPrice: data.unitPrice ?? null,
      cashAmount: data.cashAmount,
      createdAt: data.createdAt?.toMillis() ?? 0,
    };
  });
}

/** Valida y normaliza los campos del activo de una operación. */
function normalizeAsset(input: RecordTradeInput) {
  // El símbolo va en mayúsculas y sin espacios: es la clave por la que se
  // agrupan las tenencias y con la que la futura API de cotizaciones va a
  // buscar el precio, así que "aapl " y "AAPL" tienen que ser el mismo activo.
  const assetSymbol = (input.assetSymbol ?? "").trim().toUpperCase();
  if (!assetSymbol) throw new Error("Poné el símbolo del activo (ej. AAPL, BTC).");
  if (!isValidSymbol(assetSymbol)) throw new Error("Ese símbolo no es válido.");

  const assetName = (input.assetName ?? "").trim() || assetSymbol;
  if (assetName.length > ASSET_NAME_MAX) {
    throw new Error(`El nombre no puede superar los ${ASSET_NAME_MAX} caracteres.`);
  }

  const assetType: AssetType =
    input.assetType && isAssetType(input.assetType) ? input.assetType : DEFAULT_ASSET_TYPE;

  return { assetSymbol, assetName, assetType };
}

/**
 * Qué acepta un símbolo. Además del largo, **no puede tener puntos**: el
 * símbolo se usa como clave del mapa `quotes` y un punto ahí partiría la ruta
 * de campo de Firestore (`quotes.BRK.B` escribiría en `quotes → BRK → B`).
 */
function isValidSymbol(symbol: string): boolean {
  return new RegExp(`^[A-Z0-9-]{1,${ASSET_SYMBOL_MAX}}$`).test(symbol);
}

function requirePositive(value: number | undefined, message: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) throw new Error(message);
  return value;
}

/**
 * Que la fecha de la operación sea un día que exista de verdad. Misma función
 * y mismo criterio que `assertValidDay` en `habits-actions.ts`: el día es el
 * local del usuario y el server no conoce su huso, así que sólo se valida la
 * forma — no se compara contra su propio reloj.
 */
function assertValidDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("La fecha no es válida.");
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha no es válida.");
}

/**
 * Borra un asiento del libro.
 *
 * Es la **única forma de corregir** una operación: los asientos no se editan
 * (ver `WalletTradeDoc`). No hace falta recalcular nada al borrar —la tenencia
 * y el efectivo se derivan del libro en cada lectura—, pero sí puede dejar el
 * libro incompleto: borrar una compra vieja deja su venta pidiendo unidades
 * que ya no existen. En vez de bloquear el borrado (que ataría al usuario a un
 * asiento mal cargado), `portfolio()` clampea la cantidad en cero y marca la
 * tenencia como inconsistente para que la pantalla lo avise.
 */
export async function deleteTradeAction(tradeId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);

  const ref = collection(COLLECTIONS.walletTrades).doc(tradeId);
  const trade = (await ref.get()).data();
  if (!trade || trade.ownerId !== session.sub) {
    throw new Error("Esa operación no existe.");
  }

  await ref.delete();

  revalidateWalletScreens();
}

/**
 * Actualiza la cotización de un activo dentro de una cartera.
 *
 * Escribe una sola clave del mapa `quotes` con una ruta de campo
 * (`quotes.${symbol}`), que es una escritura atómica: actualizar el precio de
 * AAPL no lee ni reescribe el resto de los precios, así que dos
 * actualizaciones de símbolos distintos no se pisan. Misma mecánica que
 * `actionDoneDates` en `habits-actions.ts`.
 *
 * Es a propósito una acción chica y separada del libro: **no es una
 * operación** —no mueve efectivo ni tenencia, sólo cambia a cuánto se valúa lo
 * que ya está— y es exactamente la escritura que va a hacer la integración con
 * la API de cotizaciones cuando exista. El día que se enchufe, sólo cambia
 * quién la dispara.
 */
export async function setQuoteAction(
  walletId: string,
  assetSymbol: string,
  price: number
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppBilletera);
  await getOwnedWallet(walletId, session.sub);

  const symbol = assetSymbol.trim().toUpperCase();
  if (!isValidSymbol(symbol)) throw new Error("Ese símbolo no es válido.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("La cotización no es válida.");

  const timestamp = now();
  await collection(COLLECTIONS.wallets)
    .doc(walletId)
    .update({
      [`quotes.${symbol}`]: { price, updatedAt: timestamp },
      updatedAt: timestamp,
    });

  revalidateWalletScreens();
}
