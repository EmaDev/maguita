import "server-only";
import { ROUTES } from "@/lib/app-config";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";
import { isScheduledOn } from "@/lib/home-model";
import { notify } from "./notify";
import { localDayIn, localTimeIn } from "./quiet-hours";
import { resolveNotificationPreferences } from "./preferences";

/**
 * Emisor **programado**: recordatorio a la hora fija que el usuario eligió
 * para un hábito. Mismo espíritu que `dispatchNoteAlerts`, pero sin un
 * instante único que consultar — `alertTime` se repite todos los días
 * programados, así que acá se evalúa la hora local de cada dueño en vez de
 * un rango sobre un campo `Timestamp`.
 *
 * Pensado para el mismo cron de `POST /api/notifications/dispatch`
 * (5-15 minutos). La ventana de tolerancia de `WINDOW_MINUTES` cubre que el
 * cron no caiga justo en el minuto exacto de `alertTime`.
 */

/** Tope de hábitos con alerta activa que se evalúan por corrida. */
const MAX_PER_RUN = 300;

/**
 * Minutos desde `alertTime` en los que todavía vale avisar. Mayor que la
 * cadencia esperada del cron (5-15 min) para no perder el aviso si una
 * corrida se atrasa o se saltea una ventana.
 */
const WINDOW_MINUTES = 20;

export interface DispatchResult {
  sent: number;
  skipped: number;
  failed: number;
}

/** Minutos desde medianoche de un `HH:mm`. */
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** `true` si `nowTime` cae en `[alertTime, alertTime + WINDOW_MINUTES)`, sin cruzar medianoche. */
function isWithinReminderWindow(nowTime: string, alertTime: string): boolean {
  const diff = minutesOf(nowTime) - minutesOf(alertTime);
  return diff >= 0 && diff < WINDOW_MINUTES;
}

export async function dispatchHabitReminders(at: Date = new Date()): Promise<DispatchResult> {
  const snapshot = await collection(COLLECTIONS.habits)
    .where("alertEnabled", "==", true)
    .limit(MAX_PER_RUN)
    .get();

  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  if (snapshot.empty) return result;

  // Una zona horaria por dueño, no por hábito: varios hábitos del mismo
  // usuario no deberían pagar una consulta de preferencias cada uno.
  const timeZoneByOwner = new Map<string, string | null>();

  for (const doc of snapshot.docs) {
    const habit = withId(doc);
    if (!habit.alertTime) continue;

    let timeZone = timeZoneByOwner.get(habit.ownerId);
    if (timeZone === undefined) {
      const preferences = await resolveNotificationPreferences(habit.ownerId);
      timeZone = preferences.timeZone;
      timeZoneByOwner.set(habit.ownerId, timeZone);
    }
    if (!timeZone) continue;

    const localDay = localDayIn(timeZone, at);
    const localTime = localTimeIn(timeZone, at);
    if (!localDay || !localTime) continue;

    if (!isScheduledOn(habit.scheduledWeekdays ?? [], localDay)) continue;
    if ((habit.doneDates ?? []).includes(localDay)) continue;
    if (!isWithinReminderWindow(localTime, habit.alertTime)) continue;

    try {
      const outcome = await notify({
        userId: habit.ownerId,
        topic: "habits.reminder",
        title: `${habit.emoji} ${habit.name}`,
        description: habit.subtitle || "No te olvides de marcarlo hoy.",
        href: ROUTES.inicio,
        // Una sola vez por día por hábito, sin importar cuántas corridas del
        // cron caigan dentro de la ventana de tolerancia.
        dedupeKey: `habit-reminder:${habit.id}:${localDay}`,
      });
      if (outcome.duplicate) result.skipped += 1;
      else result.sent += 1;
    } catch (error) {
      console.error("[dispatch] recordatorio de hábito fallido", error);
      result.failed += 1;
    }
  }

  return result;
}
