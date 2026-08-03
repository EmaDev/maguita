import "server-only";
import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type PartialWithFieldValue,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import type { NotificationTone } from "lib-kit-components";
import type { QuietHours } from "@/lib/notifications/quiet-hours";
import type { NotificationTopicId } from "@/lib/notifications/topics";
import { adminDb } from "./admin";

/**
 * Registro de colecciones de Firestore.
 *
 * Todas las colecciones se nombran acá y se leen con `collection(...)`, que
 * devuelve una referencia ya tipada. Es lo que evita que el nombre de una
 * colección quede escrito a mano en cinco archivos y que un `doc.data()` se use
 * como `any`.
 *
 * Para sumar una colección: agregá la clave en `COLLECTIONS`, definí su
 * interfaz de documento acá abajo y sumá la entrada en `CollectionTypes`.
 */
export const COLLECTIONS = {
  /** Perfil de cada cuenta. El id del documento es el `uid` de Firebase Auth. */
  users: "users",
  /** Favoritos por usuario. Id del documento = `uid`. */
  favorites: "favorites",
  /** Códigos de recuperación de contraseña, de un solo uso. */
  passwordResetCodes: "passwordResetCodes",
  /**
   * Períodos del gestor de gastos (tab Movimientos). Id autogenerado: un
   * usuario puede tener varios a lo largo del tiempo, sólo uno `active` a la
   * vez. Colección compartida a futuro con la mini-app de gastos.
   */
  expenseCycles: "expenseCycles",
  /** Movimientos de cada `expenseCycles/{cycleId}`. Id autogenerado. */
  expenseMovements: "expenseMovements",
  /** Categorías del gestor de gastos por usuario. Id del documento = `uid`. */
  expenseCategories: "expenseCategories",
  /** Notas de la tab Notas. Id autogenerado: muchas por usuario. */
  notes: "notes",
  /** Links guardados de la mini-app de links. Id autogenerado: muchos por usuario. */
  links: "links",
  /** Hábitos de la tab Hábitos. Id autogenerado: muchos por usuario. */
  habits: "habits",
  /**
   * Bandeja de notificaciones que alimenta la campana del shell. Id
   * autogenerado, salvo cuando la emisión trae `dedupeKey` (ver `notify()`).
   */
  notifications: "notifications",
  /** Suscripciones Web Push, una por navegador/dispositivo. Id = `sha256(endpoint)`. */
  pushSubscriptions: "pushSubscriptions",
  /** Preferencias de notificación por usuario. Id del documento = `uid`. */
  notificationPreferences: "notificationPreferences",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/* ------------------------------------------------------------------ *
 * Documentos
 * ------------------------------------------------------------------ */

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  haptics: boolean;
  reduceData: boolean;
}

/** Mismos defaults que ya usa el cliente hoy desde `localStorage` (ver `lib/theme.ts` y `SettingsPanel`). */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  haptics: true,
  reduceData: false,
};

export interface UserDoc {
  email: string;
  name: string;
  /** Apodo libre, sin unicidad. `null` hasta que el usuario lo defina. */
  alias: string | null;
  /** URL de la foto de perfil (ej. claim `picture` de Google). `null` si no hay. */
  avatarUrl: string | null;
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FavoritesDoc {
  /** Ids de mini-apps, en el orden en que se fueron marcando. */
  miniAppIds: string[];
  updatedAt: Timestamp;
}

export interface PasswordResetCodeDoc {
  uid: string;
  email: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export type ExpenseCycleStatus = "active" | "closed";

export interface ExpenseCycleDoc {
  ownerId: string;
  /** Título libre ("Gastos vacaciones Ushuaia"). `null` = sin definir, la UI muestra el lapso de fechas. */
  title: string | null;
  /** Día de inicio y fin del período, `yyyy-mm-dd` (sin hora). */
  startDate: string;
  endDate: string;
  /** Pesos enteros, igual que `Movement.amount`. */
  initialBalance: number;
  expenseLimit: number;
  status: ExpenseCycleStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** `null` mientras está `active`. */
  closedAt: Timestamp | null;
}

export interface ExpenseMovementDoc {
  cycleId: string;
  /** Duplicado del `ownerId` del ciclo: permite validar dueño sin un `get()` extra. */
  ownerId: string;
  title: string;
  /** Nombre y emoji de la categoría al momento de cargar el gasto (ver `ExpenseCategoryItem`). */
  category: string;
  categoryEmoji: string;
  /** Negativo = gasto. Este alta sólo carga gastos, ver `addExpenseMovementAction`. */
  amount: number;
  date: string;
  createdAt: Timestamp;
}

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  emoji: string;
}

export interface ExpenseCategoriesDoc {
  /** ABM del usuario. Sin documento todavía = usa `DEFAULT_EXPENSE_CATEGORIES`. */
  categories: ExpenseCategoryItem[];
  updatedAt: Timestamp;
}

export type NotePriority = "low" | "medium" | "high";

export interface NoteDoc {
  ownerId: string;
  text: string;
  /** Día al que corresponde la nota, `yyyy-mm-dd` (no necesariamente el de creación). */
  date: string;
  priority: NotePriority;
  /** Si además de nota es un recordatorio con fecha/hora propias. */
  hasAlert: boolean;
  /** `yyyy-mm-dd`. `null` si `hasAlert` es `false`. */
  alertDate: string | null;
  /** `HH:mm`. `null` si `hasAlert` es `false`. */
  alertTime: string | null;
  /**
   * El instante exacto en que vence la alerta, derivado de
   * `alertDate`+`alertTime` **en el huso del dispositivo que la cargó** (ver
   * `alertInstant`). Es el campo por el que consulta el cron que dispara los
   * recordatorios (`dispatchNoteAlerts`): los dos strings de arriba siguen
   * siendo lo que la UI muestra, pero no se pueden comparar contra un reloj
   * sin saber de qué huso son.
   */
  alertAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LinkDoc {
  ownerId: string;
  /** URL completa, ya normalizada (siempre con protocolo). */
  url: string;
  /** Metatags Open Graph resueltos al momento del alta (`addLinkAction`) — no se vuelven a pedir en cada lectura. */
  title: string | null;
  description: string | null;
  /** URL absoluta de la imagen de preview (`og:image`/`twitter:image`), `null` si el sitio no publica una. */
  image: string | null;
  siteName: string | null;
  /** Host sin `www.`, ej. "github.com" — evita parsear `url` en el cliente sólo para mostrarlo. */
  domain: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HabitDoc {
  ownerId: string;
  /** Nombre libre, ej. "Leer 20 minutos". */
  name: string;
  /** Emoji que identifica el hábito en la lista (elegido de una paleta fija en el composer). */
  emoji: string;
  /** Meta de días por semana (1 a 7). Informativa: no afecta el cálculo de la racha. */
  goalPerWeek: number;
  /**
   * Días cumplidos, `yyyy-mm-dd`. Se escribe sólo con `arrayUnion`/
   * `arrayRemove` (ver `toggleHabitDayAction`), así que no tiene duplicados,
   * pero tampoco orden garantizado: quien lo lea debe ordenarlo si lo necesita.
   */
  doneDates: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Una entrada de la bandeja de notificaciones. La escribe siempre `notify()`
 * (`src/lib/notifications/notify.ts`), nunca un módulo a mano: es lo que
 * garantiza que el mismo evento salga por el panel y por push con el mismo
 * texto.
 */
export interface NotificationDoc {
  ownerId: string;
  /** Id del registro de topics (`src/lib/notifications/topics.ts`). */
  topic: NotificationTopicId;
  title: string;
  description: string | null;
  /** Copiado del topic al emitir: si mañana cambia el tono del topic, lo ya emitido no se repinta. */
  tone: NotificationTone;
  /** Ruta interna a la que lleva tocar la notificación. `null` = no navega. */
  href: string | null;
  read: boolean;
  readAt: Timestamp | null;
  createdAt: Timestamp;
  /**
   * Momento a partir del cual la notificación se puede borrar. Lo usa la TTL
   * policy de Firestore (campo `expiresAt`), no la app: `getNotifications` no
   * filtra por fecha.
   */
  expiresAt: Timestamp | null;
}

/**
 * Una suscripción Web Push: un navegador en un dispositivo. El id del
 * documento es `sha256(endpoint)` para que volver a suscribir el mismo
 * navegador pise la fila en vez de duplicarla.
 */
export interface PushSubscriptionDoc {
  ownerId: string;
  endpoint: string;
  /** Claves de cifrado de `PushSubscription.toJSON().keys` — sin ellas no se puede cifrar el payload. */
  p256dh: string;
  auth: string;
  /** Para poder distinguir los dispositivos en Ajustes. `null` si el navegador no lo expone. */
  userAgent: string | null;
  /** Zona horaria IANA del dispositivo, para evaluar el horario de silencio. */
  timeZone: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSuccessAt: Timestamp | null;
  /** Envíos fallidos seguidos. Un 404/410 del push service la borra directo. */
  failureCount: number;
}

/**
 * Override del push de un topic. Ausente = el `pushByDefault` del registro.
 * La entrada del panel no es configurable (ver el comentario de `topics.ts`).
 */
export interface NotificationTopicPreference {
  push: boolean;
}

export interface NotificationPreferencesDoc {
  /** Interruptor maestro de push: apagado, no sale ningún push aunque el topic lo permita. */
  pushEnabled: boolean;
  /** Overrides por topic. Las claves son `NotificationTopicId`, pero un topic borrado del registro puede sobrevivir acá. */
  topics: Record<string, NotificationTopicPreference>;
  quietHours: QuietHours;
  /** Zona horaria IANA con la que se evalúa `quietHours`. `null` = no se aplica. */
  timeZone: string | null;
  updatedAt: Timestamp;
}

/** Mapea cada colección con la forma de sus documentos. */
export interface CollectionTypes {
  [COLLECTIONS.users]: UserDoc;
  [COLLECTIONS.favorites]: FavoritesDoc;
  [COLLECTIONS.passwordResetCodes]: PasswordResetCodeDoc;
  [COLLECTIONS.expenseCycles]: ExpenseCycleDoc;
  [COLLECTIONS.expenseMovements]: ExpenseMovementDoc;
  [COLLECTIONS.expenseCategories]: ExpenseCategoriesDoc;
  [COLLECTIONS.notes]: NoteDoc;
  [COLLECTIONS.links]: LinkDoc;
  [COLLECTIONS.habits]: HabitDoc;
  [COLLECTIONS.notifications]: NotificationDoc;
  [COLLECTIONS.pushSubscriptions]: PushSubscriptionDoc;
  [COLLECTIONS.notificationPreferences]: NotificationPreferencesDoc;
}

/* ------------------------------------------------------------------ *
 * Acceso tipado
 * ------------------------------------------------------------------ */

/** Documento leído más su id, para cuando hace falta pasarlos juntos. */
export type WithId<T> = T & { id: string };

/**
 * Al escribir se aceptan `FieldValue` (`serverTimestamp()`, `arrayUnion()`, …)
 * en cualquier campo. Útil para las firmas de `update()` parciales.
 */
export type Writable<T> = PartialWithFieldValue<T>;

/**
 * El converter tipa el contenido del documento, no el id: en Firestore el id es
 * la clave, vive fuera del `data()` y ya está en `snapshot.id`. Meterlo adentro
 * del tipo obligaría a pasarlo en cada `set()`, donde es redundante.
 */
function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (model) => model as DocumentData,
    fromFirestore: (snapshot: QueryDocumentSnapshot) => snapshot.data() as T,
  };
}

/**
 * Referencia tipada a una colección.
 *
 * ```ts
 * const snap = await collection(COLLECTIONS.users).doc(uid).get();
 * snap.data()?.email // string | undefined, sin casts
 * ```
 */
export function collection<N extends CollectionName>(
  name: N
): CollectionReference<CollectionTypes[N]> {
  return adminDb()
    .collection(name)
    .withConverter(
      converter<CollectionTypes[N] & DocumentData>()
    ) as CollectionReference<CollectionTypes[N]>;
}

/** Pega el id del snapshot a sus datos, para listas que lo necesitan. */
export function withId<T>(snapshot: QueryDocumentSnapshot<T>): WithId<T> {
  return { ...snapshot.data(), id: snapshot.id };
}

/** Timestamp del server: lo pone Firestore, no el reloj de esta instancia. */
export const now = () => FieldValue.serverTimestamp();

export { FieldValue, Timestamp };
