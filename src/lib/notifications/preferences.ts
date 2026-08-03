import "server-only";
import {
  COLLECTIONS,
  collection,
  type NotificationPreferencesDoc,
} from "@/lib/firebase/collections";
import { DEFAULT_QUIET_HOURS, type QuietHours } from "./quiet-hours";
import {
  NOTIFICATION_TOPIC_IDS,
  isNotificationTopicId,
  topicOf,
  type NotificationTopicId,
} from "./topics";

/**
 * Preferencias de notificación **ya resueltas**: sin campos opcionales ni
 * huecos que cada consumidor tenga que rellenar con el default de su lado.
 *
 * Mismo criterio que `DEFAULT_PREFERENCES` en `users/{uid}` y que
 * `DEFAULT_EXPENSE_CATEGORIES`: un usuario que nunca entró a
 * `/ajustes/notificaciones` no tiene documento, y en ese hueco vale lo que
 * declara el registro de topics — no un objeto vacío.
 */
export interface ResolvedNotificationPreferences {
  /** Interruptor maestro del canal push. */
  pushEnabled: boolean;
  /** Un booleano por topic, siempre completo. */
  push: Record<NotificationTopicId, boolean>;
  quietHours: QuietHours;
  timeZone: string | null;
}

/** Estado inicial: lo que rige mientras no exista `notificationPreferences/{uid}`. */
export function defaultNotificationPreferences(): ResolvedNotificationPreferences {
  return {
    pushEnabled: true,
    push: Object.fromEntries(
      NOTIFICATION_TOPIC_IDS.map((id) => [id, topicOf(id).pushByDefault])
    ) as Record<NotificationTopicId, boolean>,
    quietHours: { ...DEFAULT_QUIET_HOURS },
    timeZone: null,
  };
}

/**
 * Aplica los overrides guardados sobre los defaults del registro.
 *
 * Se recorre el **registro**, no el documento: un topic nuevo aparece con su
 * default aunque el usuario tenga preferencias viejas guardadas, y un topic
 * que se sacó del registro deja de contar aunque su override siga en Firestore
 * (no se borra: si el topic vuelve, la elección del usuario sigue ahí).
 *
 * Los topics `required` ignoran el override — no se pueden apagar de a uno,
 * sólo con el interruptor maestro.
 */
export function applyNotificationPreferences(
  doc: NotificationPreferencesDoc | undefined
): ResolvedNotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!doc) return defaults;

  const push = { ...defaults.push };
  for (const [id, override] of Object.entries(doc.topics ?? {})) {
    if (!isNotificationTopicId(id)) continue;
    if (topicOf(id).required) continue;
    if (typeof override?.push === "boolean") push[id] = override.push;
  }

  return {
    pushEnabled: doc.pushEnabled ?? defaults.pushEnabled,
    push,
    // Spread sobre los defaults y no reemplazo: un documento guardado antes de
    // que `quietHours` existiera igual sale con la franja completa.
    quietHours: { ...defaults.quietHours, ...doc.quietHours },
    timeZone: doc.timeZone ?? null,
  };
}

/** Preferencias del usuario, listas para usar. Sólo Server Components y Server Actions. */
export async function resolveNotificationPreferences(
  userId: string
): Promise<ResolvedNotificationPreferences> {
  const snapshot = await collection(COLLECTIONS.notificationPreferences).doc(userId).get();
  return applyNotificationPreferences(snapshot.data());
}
