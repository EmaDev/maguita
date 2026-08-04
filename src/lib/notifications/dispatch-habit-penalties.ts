import "server-only";
import { ROUTES } from "@/lib/app-config";
import { COLLECTIONS, FieldValue, collection, now, withId } from "@/lib/firebase/collections";
import { HABIT_PENALTY_POINTS, isScheduledOn, shiftDay } from "@/lib/home-model";
import { notify } from "./notify";
import { localDayIn } from "./quiet-hours";
import { resolveNotificationPreferences } from "./preferences";

/**
 * Emisor **programado**: penaliza un hábito cuando pasó un día programado
 * sin marcarlo. Mismo espíritu que `dispatchHabitReminders`/
 * `dispatchNoteAlerts`, pero acá hace falta estado propio (`lastPenalizedDay`)
 * porque, a diferencia de una alerta de nota, "el día de ayer se perdió" es
 * verdad durante **todo** el día de hoy — sin ese campo, cada corrida del
 * cron (cada 5-15 min) volvería a restar puntos por lo mismo.
 *
 * Sin índice para acotar el query: escanea todos los `habits`, porque
 * `scheduledWeekdays` siempre tiene al menos un día (lo exige
 * `assertValidHabitFields`) y Firestore no puede filtrar "array no vacío".
 * Con el tope de 50 hábitos por cuenta y una app de escala personal,
 * `MAX_PER_RUN` alcanza; si esto crece, la primera optimización es agregar
 * un campo booleano para filtrar por query en vez de escanear.
 */

const MAX_PER_RUN = 500;

export interface DispatchResult {
  penalized: number;
  skipped: number;
  failed: number;
}

export async function dispatchHabitPenalties(at: Date = new Date()): Promise<DispatchResult> {
  const snapshot = await collection(COLLECTIONS.habits).limit(MAX_PER_RUN).get();

  const result: DispatchResult = { penalized: 0, skipped: 0, failed: 0 };
  if (snapshot.empty) return result;

  const timeZoneByOwner = new Map<string, string | null>();

  for (const doc of snapshot.docs) {
    const habit = withId(doc);

    let timeZone = timeZoneByOwner.get(habit.ownerId);
    if (timeZone === undefined) {
      const preferences = await resolveNotificationPreferences(habit.ownerId);
      timeZone = preferences.timeZone;
      timeZoneByOwner.set(habit.ownerId, timeZone);
    }
    if (!timeZone) continue;

    const localToday = localDayIn(timeZone, at);
    if (!localToday) continue;
    const missedDay = shiftDay(localToday, -1);

    if (habit.lastPenalizedDay === missedDay) continue;
    if (!isScheduledOn(habit.scheduledWeekdays ?? [], missedDay)) continue;
    if ((habit.doneDates ?? []).includes(missedDay)) continue;

    try {
      await doc.ref.update({
        score: FieldValue.increment(-HABIT_PENALTY_POINTS),
        lastPenalizedDay: missedDay,
        updatedAt: now(),
      });

      // El `dedupeKey` es un respaldo, no la barrera principal: `lastPenalizedDay`
      // ya frenó la resta de puntos más arriba, así que acá sólo puede llegar
      // a marcar "duplicate" si dos corridas del cron se solapan de verdad.
      const outcome = await notify({
        userId: habit.ownerId,
        topic: "habits.penalty",
        title: `${habit.emoji} Día perdido`,
        description: `Ayer no marcaste «${habit.name}». Perdiste ${HABIT_PENALTY_POINTS} puntos.`,
        href: ROUTES.inicio,
        dedupeKey: `habit-penalty:${habit.id}:${missedDay}`,
      });
      if (outcome.duplicate) result.skipped += 1;
      else result.penalized += 1;
    } catch (error) {
      console.error("[dispatch] penalización de hábito fallida", error);
      result.failed += 1;
    }
  }

  return result;
}
