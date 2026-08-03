"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { APP_NAME, ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  collection,
  now,
  type NotificationTopicPreference,
} from "@/lib/firebase/collections";
import { notify } from "@/lib/notifications/notify";
import {
  defaultNotificationPreferences,
  type ResolvedNotificationPreferences,
} from "@/lib/notifications/preferences";
import { isValidTimeOfDay, type QuietHours } from "@/lib/notifications/quiet-hours";
import { isNotificationTopicId, topicOf } from "@/lib/notifications/topics";
import { getNotificationPreferences } from "./notifications";

/**
 * Lo que el **usuario** hace con sus notificaciones: leerlas, descartarlas,
 * suscribir el dispositivo al push y configurar qué quiere recibir.
 *
 * Lo que los **módulos** emiten no pasa por acá: eso es `notify()`
 * (`lib/notifications/notify.ts`), que no es una Server Action porque no la
 * llama nunca el cliente.
 *
 * Todas re-verifican la sesión: una Server Action es un endpoint público,
 * igual que el resto de `lib/data/*-actions`.
 */

/**
 * Tope del batch. Firestore admite 500 operaciones por `WriteBatch`; la
 * bandeja se lee recortada a 50, pero "marcar todas" y "vaciar" tocan lo que
 * haya en la colección, que no está acotado por esa lectura.
 */
const MAX_BATCH = 500;

/**
 * Las notificaciones viven en el shell, que envuelve todas las pantallas. No
 * hay una ruta que revalidar en particular: se revalida el layout raíz, que es
 * de donde el panel saca sus datos.
 */
function revalidateShell(): void {
  revalidatePath("/", "layout");
}

/**
 * Trae la notificación y valida dueño en un solo lugar, igual que
 * `getOwnedNoteRef`. El Admin SDK saltea `firestore.rules`, así que este
 * chequeo es la única barrera real contra que una sesión válida marque o
 * borre la notificación de otra cuenta pasando su `id`.
 */
async function getOwnedNotificationRef(id: string, ownerId: string) {
  const ref = collection(COLLECTIONS.notifications).doc(id);
  const snapshot = await ref.get();
  const notification = snapshot.data();
  if (!notification || notification.ownerId !== ownerId) {
    throw new Error("Esa notificación ya no existe.");
  }
  return ref;
}

/** Marca una notificación como leída. Idempotente: releerla no cambia `readAt`. */
export async function markNotificationReadAction(id: string): Promise<void> {
  const session = await requireSession();
  const ref = await getOwnedNotificationRef(id, session.sub);
  await ref.update({ read: true, readAt: now() });
  revalidateShell();
}

/** Marca como leídas todas las no leídas del usuario. */
export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await requireSession();

  const snapshot = await collection(COLLECTIONS.notifications)
    .where("ownerId", "==", session.sub)
    .where("read", "==", false)
    .limit(MAX_BATCH)
    .get();
  if (snapshot.empty) return;

  const batch = adminDb().batch();
  const timestamp = now();
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { read: true, readAt: timestamp });
  }
  await batch.commit();

  revalidateShell();
}

/**
 * Descarta una notificación: la borra. Sin soft-delete — no hay pantalla de
 * "notificaciones descartadas" que lo necesite, mismo criterio que
 * `deleteNoteAction`.
 */
export async function dismissNotificationAction(id: string): Promise<void> {
  const session = await requireSession();
  const ref = await getOwnedNotificationRef(id, session.sub);
  await ref.delete();
  revalidateShell();
}

/** Vacía la bandeja del usuario. */
export async function clearNotificationsAction(): Promise<void> {
  const session = await requireSession();

  const snapshot = await collection(COLLECTIONS.notifications)
    .where("ownerId", "==", session.sub)
    .limit(MAX_BATCH)
    .get();
  if (snapshot.empty) return;

  const batch = adminDb().batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await batch.commit();

  revalidateShell();
}

/* ------------------------------------------------------------------ *
 * Suscripciones push
 * ------------------------------------------------------------------ */

export interface SavePushSubscriptionInput {
  /** URL del push service que devolvió `PushManager.subscribe`. */
  endpoint: string;
  /** Claves de `PushSubscription.toJSON().keys`. */
  p256dh: string;
  auth: string;
  /** Zona horaria IANA del dispositivo, para el horario de silencio. */
  timeZone?: string | null;
  userAgent?: string | null;
}

/**
 * El id del documento se deriva del endpoint, no es autogenerado: el mismo
 * navegador puede volver a suscribirse (tras un `unsubscribe`, o porque el
 * push service rotó la suscripción) y sin esto quedarían dos filas apuntando
 * al mismo destino, o sea dos pushes idénticos por evento.
 */
function pushSubscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

/**
 * Da de alta (o refresca) la suscripción push de este dispositivo.
 *
 * Es la contracara del `onSubscribe` de `usePushSubscription`. Escribe con
 * `set({ merge: true })` para no pisar `createdAt` ni el historial de envíos
 * cuando el mismo navegador se vuelve a suscribir.
 */
export async function savePushSubscriptionAction(
  input: SavePushSubscriptionInput
): Promise<void> {
  const session = await requireSession();

  if (!input.endpoint.startsWith("https://") || !input.p256dh || !input.auth) {
    throw new Error("La suscripción de este navegador no es válida.");
  }

  const ref = collection(COLLECTIONS.pushSubscriptions).doc(pushSubscriptionId(input.endpoint));
  const existing = await ref.get();

  await ref.set(
    {
      ownerId: session.sub,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      // El userAgent se recorta: no se muestra crudo, sólo alcanza para
      // distinguir un dispositivo de otro en la lista de Ajustes.
      userAgent: input.userAgent?.slice(0, 200) ?? null,
      timeZone: input.timeZone ?? null,
      updatedAt: now(),
      ...(existing.exists
        ? {}
        : { createdAt: now(), lastSuccessAt: null, failureCount: 0 }),
    },
    { merge: true }
  );

  revalidateShell();
}

/**
 * Da de baja la suscripción de un endpoint. La llama `onUnsubscribe` **antes**
 * de que el navegador destruya la suscripción, que es el último momento en que
 * todavía se conoce el endpoint.
 *
 * Un endpoint que no existe o que es de otra cuenta se ignora en silencio: el
 * objetivo (que este server no le mande más push a ese destino) ya está
 * cumplido, y fallar distinto según el caso delataría qué endpoints existen.
 */
export async function deletePushSubscriptionAction(endpoint: string): Promise<void> {
  const session = await requireSession();

  const ref = collection(COLLECTIONS.pushSubscriptions).doc(pushSubscriptionId(endpoint));
  const snapshot = await ref.get();
  if (snapshot.data()?.ownerId !== session.sub) return;

  await ref.delete();
  revalidateShell();
}

/** Saca un dispositivo desde la lista de Ajustes (no desde el propio dispositivo). */
export async function deletePushDeviceAction(id: string): Promise<void> {
  const session = await requireSession();

  const ref = collection(COLLECTIONS.pushSubscriptions).doc(id);
  const snapshot = await ref.get();
  if (snapshot.data()?.ownerId !== session.sub) {
    throw new Error("Ese dispositivo ya no está registrado.");
  }

  await ref.delete();
  revalidatePath(ROUTES.notificaciones);
}

/* ------------------------------------------------------------------ *
 * Preferencias
 * ------------------------------------------------------------------ */

export interface UpdateNotificationPreferencesInput {
  pushEnabled: boolean;
  /** Un booleano por topic. Los ids desconocidos y los `required` se descartan. */
  push: Record<string, boolean>;
  quietHours: QuietHours;
  /** `Intl.DateTimeFormat().resolvedOptions().timeZone` del dispositivo. */
  timeZone: string | null;
}

/**
 * Guarda las preferencias y devuelve el estado ya resuelto, para que la
 * pantalla no tenga que volver a pedirlo (mismo criterio que
 * `upsertExpenseCategoryAction`, que devuelve el array completo).
 *
 * Los overrides de los topics `required` **no se guardan**: el registro es la
 * fuente de verdad de qué se puede apagar, y aceptarlos dejaría una preferencia
 * guardada que después `applyNotificationPreferences` ignora — un interruptor
 * que parece hacer algo y no hace nada.
 */
export async function updateNotificationPreferencesAction(
  input: UpdateNotificationPreferencesInput
): Promise<ResolvedNotificationPreferences> {
  const session = await requireSession();

  if (!isValidTimeOfDay(input.quietHours.from) || !isValidTimeOfDay(input.quietHours.to)) {
    throw new Error("El horario de silencio no es válido.");
  }

  const topics: Record<string, NotificationTopicPreference> = {};
  for (const [id, push] of Object.entries(input.push)) {
    if (!isNotificationTopicId(id)) continue;
    if (topicOf(id).required) continue;
    topics[id] = { push: Boolean(push) };
  }

  await collection(COLLECTIONS.notificationPreferences).doc(session.sub).set(
    {
      pushEnabled: Boolean(input.pushEnabled),
      topics,
      quietHours: {
        enabled: Boolean(input.quietHours.enabled),
        from: input.quietHours.from,
        to: input.quietHours.to,
      },
      timeZone: input.timeZone,
      updatedAt: now(),
    },
    // Sin merge: `topics` es el mapa completo, y un merge dejaría vivo el
    // override de un topic que el usuario acaba de sacar de la pantalla.
    { merge: false }
  );

  revalidatePath(ROUTES.notificaciones);
  return getNotificationPreferences(session.sub);
}

/** Estado inicial, para el botón "restablecer" de la pantalla de preferencias. */
export async function resetNotificationPreferencesAction(): Promise<ResolvedNotificationPreferences> {
  const session = await requireSession();
  await collection(COLLECTIONS.notificationPreferences).doc(session.sub).delete();
  revalidatePath(ROUTES.notificaciones);
  return defaultNotificationPreferences();
}

/**
 * Manda una notificación de prueba a la propia cuenta, para que el usuario
 * pueda comprobar que el push le llega de verdad sin tener que esperar a que
 * pase algo.
 *
 * Va con `force`: el usuario acaba de tocar el botón, así que saltear sus
 * propias preferencias y el horario de silencio es lo que espera — si no, la
 * prueba "no funciona" justo cuando la hace de noche.
 */
export async function sendTestNotificationAction(): Promise<{ pushed: number }> {
  const session = await requireSession();

  const result = await notify({
    userId: session.sub,
    topic: "system.account",
    title: "Notificación de prueba",
    description: `Si viste este aviso, ${APP_NAME} puede avisarte en este dispositivo.`,
    href: ROUTES.notificaciones,
    force: true,
  });

  revalidateShell();
  return { pushed: result.pushed };
}
