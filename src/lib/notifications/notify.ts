import "server-only";
import { createHash } from "node:crypto";
import { APP_NAME, ROUTES } from "@/lib/app-config";
import {
  COLLECTIONS,
  Timestamp,
  collection,
  now,
  type PushSubscriptionDoc,
} from "@/lib/firebase/collections";
import { resolveNotificationPreferences } from "./preferences";
import { isWithinQuietHours } from "./quiet-hours";
import { topicOf, type NotificationTopicId } from "./topics";
import { sendWebPush, type PushPayload } from "./web-push";

/**
 * **La API de notificaciones de la app.** Cualquier módulo o mini-app que
 * quiera avisarle algo a un usuario llama a `notify()` y no toca nada más:
 *
 * ```ts
 * await notify({
 *   userId: session.sub,
 *   topic: "expenses.limit-reached",
 *   title: "Llegaste al tope del período",
 *   description: "Ya gastaste $120.000 de los $100.000 que te pusiste.",
 *   href: ROUTES.inicio,
 *   dedupeKey: `over:${cycleId}`,
 * });
 * ```
 *
 * De ahí en adelante se ocupa esta función: escribe la entrada de la bandeja
 * (la campana del shell la lee en cada carga), resuelve las preferencias del
 * usuario y el horario de silencio, y manda el push a cada dispositivo suyo,
 * limpiando de paso las suscripciones muertas.
 *
 * El único requisito es que el `topic` exista en `topics.ts` — el tipo no
 * compila si no.
 */

/** Vencimiento por defecto de una entrada de la bandeja. */
const DEFAULT_TTL_DAYS = 30;

/** Fallos seguidos tras los cuales se descarta una suscripción push. */
const MAX_PUSH_FAILURES = 3;

/** Tope de caracteres del cuerpo del push: más que esto lo recorta el sistema igual. */
const PUSH_BODY_MAX = 160;

export interface NotifyInput {
  /** `uid` del destinatario. */
  userId: string;
  topic: NotificationTopicId;
  title: string;
  description?: string | null;
  /** Ruta interna a la que lleva tocar la notificación. Default: Inicio. */
  href?: string | null;
  /**
   * Hace la emisión **idempotente**: con la misma `dedupeKey` (para el mismo
   * usuario y topic) la segunda llamada no escribe nada ni manda push. Es lo
   * que evita, por ejemplo, que "llegaste al tope" salga de nuevo con cada
   * gasto que se cargue después de haberlo pasado.
   */
  dedupeKey?: string;
  /** Días hasta que la entrada se puede borrar (TTL de Firestore). */
  ttlDays?: number;
  /**
   * Ignora las preferencias del usuario y el horario de silencio. Reservado
   * para lo que el usuario acaba de pedir a mano — hoy, sólo la notificación
   * de prueba de Ajustes. Nunca para un evento automático: es exactamente lo
   * que las preferencias existen para poder apagar.
   */
  force?: boolean;
}

export interface NotifyResult {
  /** Id de la entrada creada, o de la que ya existía si fue duplicada. */
  id: string;
  /** `true` si la `dedupeKey` ya se había usado: no se escribió ni se mandó nada. */
  duplicate: boolean;
  /** Dispositivos a los que el push llegó de verdad. */
  pushed: number;
  /** Por qué no salió el push, si no salió. `null` = salió (o no había a quién). */
  pushSkipped: "muted" | "quiet-hours" | null;
}

/**
 * Emite una notificación por todos los canales que correspondan.
 *
 * Tira si Firestore rechaza la escritura (un error de verdad, no un
 * dispositivo caído). Desde adentro de una Server Action que hace otra cosa,
 * usá `notifyQuietly` — ver más abajo.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const topic = topicOf(input.topic);
  const notifications = collection(COLLECTIONS.notifications);

  /* Con `dedupeKey` el id se deriva del evento, así que el propio Firestore es
     el que garantiza el "una sola vez": `create()` falla si el documento ya
     existe, sin transacción ni lectura previa. Sin `dedupeKey` va un id
     autogenerado y cada llamada es una notificación nueva. */
  const id = input.dedupeKey
    ? createHash("sha256")
        .update(`${input.userId}:${input.topic}:${input.dedupeKey}`)
        .digest("hex")
    : notifications.doc().id;
  const ref = notifications.doc(id);

  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const data = {
    ownerId: input.userId,
    topic: input.topic,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    // El tono se copia del topic en vez de referenciarlo: si mañana el topic
    // cambia de color, lo ya emitido no se repinta solo.
    tone: topic.tone,
    href: input.href ?? ROUTES.inicio,
    read: false,
    readAt: null,
    createdAt: now(),
    expiresAt: Timestamp.fromMillis(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  };

  if (input.dedupeKey) {
    try {
      await ref.create(data);
    } catch (error) {
      if (isAlreadyExists(error)) {
        return { id, duplicate: true, pushed: 0, pushSkipped: null };
      }
      throw error;
    }
  } else {
    await ref.set(data);
  }

  const skipped = await pushSkipReason(input.userId, input.topic, input.force);
  if (skipped) {
    return { id, duplicate: false, pushed: 0, pushSkipped: skipped };
  }

  const pushed = await deliverPush(input.userId, {
    title: data.title,
    body: truncate(data.description ?? APP_NAME, PUSH_BODY_MAX),
    url: data.href,
    // Con la misma `tag`, un aviso nuevo del mismo evento reemplaza al
    // anterior en la bandeja del sistema en vez de apilarse.
    tag: input.dedupeKey ? id : input.topic,
    badgeCount: await countUnread(input.userId),
  });

  return { id, duplicate: false, pushed, pushSkipped: null };
}

/**
 * `notify()` para llamar desde adentro de una Server Action que está haciendo
 * otra cosa (cargar un gasto, marcar un hábito). Traga cualquier error: que
 * falle el aviso no puede hacer fallar la operación que el usuario realmente
 * pidió — y menos revertir la impresión de que se guardó, cuando se guardó.
 */
export async function notifyQuietly(input: NotifyInput): Promise<void> {
  try {
    await notify(input);
  } catch (error) {
    console.error(`[notify] falló la emisión de ${input.topic}`, error);
  }
}

/* ------------------------------------------------------------------ *
 * Interno
 * ------------------------------------------------------------------ */

/**
 * Por qué no corresponde mandar push, o `null` si corresponde. Los topics
 * `required` saltean el interruptor del topic pero **no** el maestro ni el
 * horario de silencio: esos dos son decisiones del usuario sobre el canal
 * entero, no sobre un tipo de aviso.
 */
async function pushSkipReason(
  userId: string,
  topicId: NotificationTopicId,
  force?: boolean
): Promise<NotifyResult["pushSkipped"]> {
  if (force) return null;

  const preferences = await resolveNotificationPreferences(userId);
  if (!preferences.pushEnabled) return "muted";
  if (!preferences.push[topicId]) return "muted";
  if (isWithinQuietHours(preferences.quietHours, preferences.timeZone)) return "quiet-hours";
  return null;
}

/**
 * Manda el push a todos los dispositivos del usuario en paralelo y actualiza
 * el estado de cada suscripción con el resultado.
 *
 * Las suscripciones se limpian solas: un 404/410 del push service significa
 * que ese navegador ya no existe (PWA desinstalada, datos borrados, permiso
 * revocado) y se borra en el acto; los fallos de otro tipo — que pueden ser un
 * corte pasajero del push service — se acumulan y recién a los
 * `MAX_PUSH_FAILURES` seguidos borran la fila. Sin esto, la colección crecería
 * para siempre con endpoints muertos a los que se les paga un intento cada vez.
 */
async function deliverPush(userId: string, payload: PushPayload): Promise<number> {
  const snapshot = await collection(COLLECTIONS.pushSubscriptions)
    .where("ownerId", "==", userId)
    .get();
  if (snapshot.empty) return 0;

  const results = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const subscription: PushSubscriptionDoc = doc.data();
      const result = await sendWebPush(subscription, payload);

      if (result === "sent") {
        await doc.ref.update({ lastSuccessAt: now(), failureCount: 0 });
      } else if (result === "gone") {
        await doc.ref.delete();
      } else {
        const failureCount = (subscription.failureCount ?? 0) + 1;
        if (failureCount >= MAX_PUSH_FAILURES) await doc.ref.delete();
        else await doc.ref.update({ failureCount, updatedAt: now() });
      }

      return result;
    })
  );

  return results.filter((result) => result === "sent").length;
}

/**
 * No leídas del usuario, para el badge del ícono de la app instalada. Es una
 * agregación (`count()`), no una lectura de los documentos: cuesta lo mismo
 * tener 3 que 300.
 */
async function countUnread(userId: string): Promise<number> {
  const snapshot = await collection(COLLECTIONS.notifications)
    .where("ownerId", "==", userId)
    .where("read", "==", false)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * El `create()` de un documento que ya existe. El Admin SDK devuelve el código
 * gRPC 6 (`ALREADY_EXISTS`); el chequeo del mensaje es el respaldo para cuando
 * el error viaja serializado y pierde el `code`.
 */
function isAlreadyExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 6 || (typeof message === "string" && message.includes("ALREADY_EXISTS"));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
