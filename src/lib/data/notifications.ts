import "server-only";
import type { AppNotification } from "lib-kit-components";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import {
  applyNotificationPreferences,
  type ResolvedNotificationPreferences,
} from "@/lib/notifications/preferences";

/**
 * Lectura de la bandeja de notificaciones y de las preferencias del usuario.
 * La escritura vive en `notifications-actions.ts` (lo que toca el usuario) y en
 * `lib/notifications/notify.ts` (lo que emiten los módulos).
 */

/**
 * Cuántas notificaciones baja el panel. Lo que queda afuera no se pierde:
 * sigue en Firestore hasta que lo levante la TTL de `expiresAt`.
 */
const MAX_INBOX = 50;

/**
 * Notificaciones del usuario, más reciente primero.
 *
 * Filtra sólo por `ownerId` (equality) y **ordena en memoria**, igual que
 * `getNotes`/`getHabits`/`getLinks`. La primera versión ordenaba en Firestore
 * (`orderBy("createdAt","desc")` + `limit`) para no bajar de más, y eso pedía
 * un índice compuesto: mientras el índice no estuviera publicado, la consulta
 * tiraba `FAILED_PRECONDITION` y —como esto se lee desde el layout— se caía
 * **toda** la app, no sólo la campana. No vale la pena: la bandeja de una
 * cuenta está acotada por la TTL de 30 días, así que es del mismo orden que
 * sus notas, y así el repo sigue sin depender de ningún índice compuesto.
 *
 * Nunca tira: si Firestore falla, la campana queda vacía y las pantallas
 * siguen andando. Es un panel de avisos — que no cargue no puede ser motivo
 * para que el usuario no pueda entrar a ver sus gastos.
 */
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  let snapshot;
  try {
    snapshot = await collection(COLLECTIONS.notifications)
      .where("ownerId", "==", userId)
      .get();
  } catch (error) {
    console.error("[notifications] no se pudo leer la bandeja", error);
    return [];
  }

  return snapshot.docs
    .map((doc) => withId(doc))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .slice(0, MAX_INBOX)
    .map((data) => ({
      id: data.id,
      title: data.title,
      /* `AppNotification.description` es opcional y no acepta `null`. */
      ...(data.description ? { description: data.description } : {}),
      /* La fecha viaja como ISO y no como `Date`: cruza el límite
         server→cliente como prop, y un string se serializa igual en los dos
         lados. `relativeTime` del kit lo parsea solo.

         `createdAt` puede venir `null` en el instante entre el `set()` y que
         el server resuelva el `serverTimestamp()`; en ese hueco vale ahora,
         que es lo que el usuario está viendo pasar. */
      date: (data.createdAt?.toDate() ?? new Date()).toISOString(),
      read: data.read,
      tone: data.tone,
      ...(data.href ? { href: data.href } : {}),
    }));
}

/**
 * No leídas del usuario, para el badge de la campana y el ícono de la app.
 * Dos filtros de igualdad: Firestore los resuelve con los índices de un solo
 * campo, sin pedir uno compuesto.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const snapshot = await collection(COLLECTIONS.notifications)
    .where("ownerId", "==", userId)
    .where("read", "==", false)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Preferencias del usuario ya resueltas contra los defaults del registro de
 * topics. Sólo Server Components — la pantalla de Ajustes las recibe como
 * prop y las edita con `updateNotificationPreferencesAction`.
 */
export async function getNotificationPreferences(
  userId: string
): Promise<ResolvedNotificationPreferences> {
  const snapshot = await collection(COLLECTIONS.notificationPreferences).doc(userId).get();
  return applyNotificationPreferences(snapshot.data());
}

/** Un dispositivo suscripto al push, para la lista de Ajustes. */
export interface PushDevice {
  id: string;
  /** `userAgent` crudo del navegador. La UI lo resume. */
  userAgent: string | null;
  createdAt: string;
  lastSuccessAt: string | null;
}

/** Dispositivos con push activo de la cuenta, más reciente primero. */
export async function getPushDevices(userId: string): Promise<PushDevice[]> {
  const snapshot = await collection(COLLECTIONS.pushSubscriptions)
    .where("ownerId", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .map((data) => ({
      id: data.id,
      userAgent: data.userAgent,
      createdAt: (data.createdAt?.toDate() ?? new Date()).toISOString(),
      lastSuccessAt: data.lastSuccessAt?.toDate().toISOString() ?? null,
    }));
}
