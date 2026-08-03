import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import { isWithinQuietHours } from "@/lib/notifications/quiet-hours";
import { isPushConfigured } from "@/lib/notifications/web-push";
import {
  countUnreadNotifications,
  getNotificationPreferences,
  getPushDevices,
  type PushDevice,
} from "./notifications";

/**
 * Estado del sistema de notificaciones, para el diagnóstico de `/debug`.
 *
 * Junta en una sola lectura las tres cosas que uno quiere saber cuando algo no
 * llega: si el server está configurado, si la cuenta tiene dispositivos y
 * preferencias que lo permitan, y qué alertas hay programadas.
 */

/** Una nota con alerta, tal como la ve el cron. */
export interface DebugNoteAlert {
  id: string;
  text: string;
  alertDate: string | null;
  alertTime: string | null;
  /**
   * `null` en notas guardadas antes de que existiera `alertAt`. Son
   * precisamente las que el cron **no** encuentra: la pantalla las marca para
   * que se vea de una que hay que volver a guardarlas.
   */
  alertAtMs: number | null;
}

export interface NotificationsDebugState {
  /** Hay par de claves VAPID en el `.env` del server. */
  pushConfigured: boolean;
  /** Primeros caracteres de la clave pública: confirma *cuál* está cargada sin exponerla entera. */
  publicKeyPreview: string | null;
  /** Está seteado `NOTIFICATIONS_CRON_SECRET` (sin él, el endpoint del cron devuelve 401). */
  cronSecretSet: boolean;
  devices: PushDevice[];
  pushEnabled: boolean;
  /** Topics con push apagado para esta cuenta. Vacío = todos prendidos. */
  mutedTopics: string[];
  /** La cuenta está ahora mismo en horario de silencio, según la zona guardada. */
  quietNow: boolean;
  timeZone: string | null;
  unread: number;
  alerts: DebugNoteAlert[];
}

export async function getNotificationsDebugState(
  userId: string
): Promise<NotificationsDebugState> {
  const [preferences, devices, unread, alerts] = await Promise.all([
    getNotificationPreferences(userId),
    getPushDevices(userId),
    countUnreadNotifications(userId),
    getNoteAlerts(userId),
  ]);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return {
    pushConfigured: isPushConfigured,
    publicKeyPreview: publicKey ? `${publicKey.slice(0, 12)}…` : null,
    cronSecretSet: Boolean(process.env.NOTIFICATIONS_CRON_SECRET),
    devices,
    pushEnabled: preferences.pushEnabled,
    mutedTopics: Object.entries(preferences.push)
      .filter(([, enabled]) => !enabled)
      .map(([topic]) => topic),
    quietNow: isWithinQuietHours(preferences.quietHours, preferences.timeZone),
    timeZone: preferences.timeZone,
    unread,
    alerts,
  };
}

/**
 * Notas con alerta de la cuenta, más próxima primero.
 *
 * Filtra por dos igualdades (`ownerId` + `hasAlert`) y ordena en memoria, en
 * vez del rango sobre `alertAt` que usa el cron: acá interesa ver **todas** las
 * alertas de la cuenta, incluidas las que no tienen `alertAt` — que son
 * justamente las invisibles para el cron. Dos igualdades no piden índice
 * compuesto.
 */
async function getNoteAlerts(userId: string): Promise<DebugNoteAlert[]> {
  const snapshot = await collection(COLLECTIONS.notes)
    .where("ownerId", "==", userId)
    .where("hasAlert", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const note = withId(doc);
      return {
        id: note.id,
        text: note.text,
        alertDate: note.alertDate,
        alertTime: note.alertTime,
        alertAtMs: note.alertAt?.toMillis() ?? null,
      };
    })
    .sort((a, b) => (a.alertAtMs ?? Infinity) - (b.alertAtMs ?? Infinity));
}
