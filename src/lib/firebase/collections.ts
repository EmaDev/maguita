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
  /** Rutinas de la mini-app de entrenamiento. Id autogenerado: varias por usuario, una sola `active`. */
  workoutRoutines: "workoutRoutines",
  /** Días entrenados de la mini-app de entrenamiento. Id = `{uid}_{yyyy-mm-dd}`: uno por día. */
  workoutSessions: "workoutSessions",
  /**
   * Ejercicios propios del usuario, los que suma con el ABM de la biblioteca.
   * Id autogenerado. El catálogo base **no** vive acá: es estático, en
   * `src/lib/exercise-catalog.ts` (ver la nota de diseño de ese módulo).
   */
  customExercises: "customExercises",
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
  /** sha256 hex del PIN de 4 dígitos compartido. `null` = PinLock desactivado, no puede haber ningún módulo bloqueado. */
  pinHash: string | null;
  /**
   * Ids de módulos/mini-apps con el candado de PinLock activo. Mismos ids que
   * `HomeTab` ("movimientos"/"notas"/"habitos", ver `home/tabs.ts`) para los
   * tabs de Inicio, o `MiniApp.id` (`lib/data/mini-apps.ts`) para mini-apps.
   */
  lockedModules: string[];
}

/** Mismos defaults que ya usa el cliente hoy desde `localStorage` (ver `lib/theme.ts` y `SettingsPanel`). */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  haptics: true,
  reduceData: false,
  pinHash: null,
  lockedModules: [],
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
  /** Descripción propia del usuario, distinta de `description` (la de los metatags). `null` = no puso ninguna. */
  note: string | null;
  /** Categoría libre del usuario, ej. "Trabajo", "Recetas". `null` = sin categorizar. */
  category: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HabitDoc {
  ownerId: string;
  /** Nombre libre, ej. "Leer 20 minutos". */
  name: string;
  /** Bajada libre y corta, ej. "Antes de dormir". `null` = sin subtítulo. */
  subtitle: string | null;
  /** Emoji que identifica el hábito en la lista (elegido de una paleta fija en el composer). */
  emoji: string;
  /**
   * Días de la semana en que aplica el hábito, convención `Date.getDay()`
   * (0 = domingo … 6 = sábado). 1 a 7 valores únicos. Reemplaza al viejo
   * `goalPerWeek`: la meta semanal ahora es `scheduledWeekdays.length`.
   */
  scheduledWeekdays: number[];
  /** Si hay que avisar a una hora fija los días programados. */
  alertEnabled: boolean;
  /** `HH:mm`, hora local del dueño. `null` si `alertEnabled` es `false`. */
  alertTime: string | null;
  /**
   * Puntaje acumulado. Sube al marcar un día programado, baja al
   * desmarcarlo o cuando el job diario detecta que se perdió uno (ver
   * `dispatch-habit-penalties.ts`). Puede ser negativo.
   */
  score: number;
  /** Posición manual en la lista (drag & drop). Menor = más arriba. */
  order: number;
  /**
   * Último día (`yyyy-mm-dd`, local del dueño) ya penalizado por perder un
   * día programado. Evita que el job de penalización reste dos veces por el
   * mismo día en corridas sucesivas del cron.
   */
  lastPenalizedDay: string | null;
  /**
   * Días cumplidos, `yyyy-mm-dd`. Se escribe sólo con `arrayUnion`/
   * `arrayRemove` (ver `toggleHabitDayAction`), así que no tiene duplicados,
   * pero tampoco orden garantizado: quien lo lea debe ordenarlo si lo necesita.
   *
   * Para un hábito con `actions`, este campo se vuelve **derivado**: sólo se
   * prende un día acá cuando *todas* las acciones de ese día están cumplidas
   * (ver `toggleHabitActionAction`). Con `actions: []` (hábito simple) sigue
   * siendo la fuente directa, como siempre.
   */
  doneDates: string[];
  /**
   * Pasos del hábito, en el orden en que se muestran. `[]` = hábito
   * "simple" (un solo check, comportamiento de siempre). No vacío = hábito
   * "de grupo": se muestra como timeline y el día sólo cuenta como cumplido
   * cuando se tildan todos.
   */
  actions: HabitActionDoc[];
  /**
   * Días cumplidos por acción, clave = `HabitActionDoc.id`. Un mapa y no un
   * array anidado dentro de `actions` porque Firestore no permite
   * `arrayUnion`/`arrayRemove` apuntado a un campo *dentro* de un elemento
   * de array (no hay forma de direccionar "el elemento con id X" en una
   * escritura) — un mapa sí soporta rutas de campo por clave
   * (`actionDoneDates.${actionId}`), así que cada acción puede actualizar su
   * propio historial atómicamente, igual que `doneDates` del hábito.
   */
  actionDoneDates: Record<string, string[]>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HabitActionDoc {
  /** Generado en el cliente (`crypto.randomUUID()`), estable entre ediciones. */
  id: string;
  /** Nombre libre del paso. Máx. 60 caracteres, igual tope que `HabitDoc.name`. */
  name: string;
}

/**
 * Tipo de entrenamiento de una rutina. Lista cerrada: el registro con su
 * etiqueta y emoji vive en `src/lib/workout-model.ts`, que es puro y lo
 * comparten la validación del server y los chips del composer.
 */
export type WorkoutType = "gimnasio" | "crossfit" | "aire-libre" | "casa" | "funcional" | "otro";

export interface WorkoutExerciseDoc {
  /** Generado en el cliente (`crypto.randomUUID()`), estable entre ediciones. Es la fila de la rutina, no el ejercicio de la biblioteca. */
  id: string;
  /** Nombre del ejercicio, ej. "Banco plano". Se **copia** de la biblioteca al elegirlo, no se referencia. */
  name: string;
  /** Series/repeticiones/tiempo como texto libre y corto, ej. "4x10" o "20 min". `null` = sin detalle. */
  detail: string | null;
  /**
   * Ejercicio de la biblioteca del que salió esta fila: un id del catálogo
   * estático (`src/lib/exercise-catalog.ts`) o el id de un
   * `customExercises/{id}`. Es lo que permite mostrar descripción y consejos
   * desde la rutina. `null` = se escribió a mano, sin pasar por la
   * biblioteca; también es lo que traen las filas cargadas antes de que la
   * biblioteca existiera.
   */
  exerciseId: string | null;
}

/**
 * Un ejercicio propio del usuario (ABM de la biblioteca). Misma forma que
 * `ExerciseInfo` del catálogo estático menos el `id`, que acá es el id del
 * documento — así los dos se pueden mezclar en una sola lista.
 */
export interface CustomExerciseDoc {
  ownerId: string;
  name: string;
  /** `MuscleGroup` de `src/lib/exercise-catalog.ts`. */
  group: string;
  /** `ExerciseEquipment` de `src/lib/exercise-catalog.ts`. */
  equipment: string;
  description: string | null;
  /** Consejos de ejecución, uno por línea en el formulario. `[]` = no cargó ninguno. */
  tips: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Un día de entrenamiento de la rutina: qué toca ese día de la semana.
 * `weekday` sigue la convención `Date.getDay()` (0 = domingo … 6 = sábado),
 * la misma que `HabitDoc.scheduledWeekdays`, y es único dentro de la rutina —
 * los días de descanso simplemente no tienen entrada acá.
 */
export interface WorkoutDayDoc {
  weekday: number;
  /** Qué se entrena ese día, ej. "Pecho y tríceps". */
  title: string;
  exercises: WorkoutExerciseDoc[];
}

export interface WorkoutRoutineDoc {
  ownerId: string;
  /** Nombre libre, ej. "Full body 3 días". */
  name: string;
  type: WorkoutType;
  /** Bajada libre y corta. `null` = sin descripción. */
  description: string | null;
  /** Días de entrenamiento, ordenados por `weekday` arrancando el lunes. */
  days: WorkoutDayDoc[];
  /**
   * Rutina que la pantalla usa para resolver "qué toca hoy" y contra la que se
   * mide la racha. Sólo una `active` por cuenta a la vez, garantizado por
   * transacción en `activateRoutineAction` — mismo criterio que el `status`
   * de `expenseCycles`.
   */
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Un día efectivamente entrenado. El id del documento es `{uid}_{yyyy-mm-dd}`,
 * no autogenerado: hace que marcar el día sea idempotente (un `set()` pisa el
 * registro anterior en vez de duplicarlo) y que no haga falta una consulta
 * previa para editar la nota de un día ya marcado.
 */
export interface WorkoutSessionDoc {
  ownerId: string;
  /** Día entrenado, `yyyy-mm-dd` local del usuario. Duplica lo que ya dice el id, para poder filtrar/ordenar por campo. */
  date: string;
  /** Rutina con la que se entrenó. `null` = entrenamiento suelto, sin rutina activa al registrarlo. */
  routineId: string | null;
  /** Nombre y tipo de la rutina **copiados** al registrar, como `category` en `expenseMovements`: el historial no se reescribe si después se renombra o borra la rutina. */
  routineName: string | null;
  type: WorkoutType;
  /** Qué se entrenó ese día: el título del día de la rutina, o lo que el usuario escriba. */
  title: string;
  /** Nota libre del día ("me costó, bajé el peso"). `null` = no dejó ninguna. */
  note: string | null;
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
  [COLLECTIONS.workoutRoutines]: WorkoutRoutineDoc;
  [COLLECTIONS.workoutSessions]: WorkoutSessionDoc;
  [COLLECTIONS.customExercises]: CustomExerciseDoc;
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
