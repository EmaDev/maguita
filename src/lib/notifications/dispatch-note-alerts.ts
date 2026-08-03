import "server-only";
import { ROUTES } from "@/lib/app-config";
import { COLLECTIONS, Timestamp, collection, withId } from "@/lib/firebase/collections";
import { notify } from "./notify";

/**
 * Emisor **programado**: el único que no lo dispara una acción del usuario.
 *
 * Una nota con alerta guarda el instante exacto en que vence (`alertAt`, ver
 * `alertInstant`). Cuando llega ese momento no hay ninguna Server Action
 * corriendo que pueda avisar, así que hace falta que alguien pase a mirar: ese
 * alguien es `POST /api/notifications/dispatch`, pensado para que lo llame un
 * cron cada 5-15 minutos. La precisión del recordatorio es, entonces, la
 * frecuencia del cron: con uno cada 5 minutos una alerta de las 09:00 suena
 * entre las 09:00 y las 09:05, nunca antes.
 *
 * Es el patrón a copiar para cualquier aviso futuro que dependa del reloj y no
 * de un click: el módulo exporta una función como esta y el route handler la
 * suma a su `Promise.all`.
 */

/**
 * Cuánto para atrás se miran las alertas vencidas. Cubre que el cron se saltee
 * una corrida (o varias) sin que la alerta se pierda; más allá de eso, avisar
 * de un recordatorio de anteayer es peor que no avisar.
 */
const LOOKBACK_HOURS = 24;

/**
 * Tope de alertas por corrida. Si alguna vez se acumulan más (el cron estuvo
 * caído medio día), se procesan las más viejas y el resto entra en la corrida
 * siguiente — mejor que una request que se cae por timeout y no manda ninguna.
 *
 * El número está atado al `maxDuration` del route handler: 100 alertas a 8 en
 * paralelo son ~13 tandas, y cada una cuesta lo que tarda el push service más
 * lento del lote. Entra holgado en los 60s que permite Vercel.
 */
const MAX_PER_RUN = 100;

/**
 * Alertas que se procesan a la vez. Secuencial, cada una paga su viaje a
 * Firestore y al push service de punta a punta: cien alertas serían minutos, y
 * la función se corta por timeout antes de terminar. Sin tope tampoco sirve —
 * cien `notify()` simultáneos abren cien conexiones y hacen colapsar el pool
 * del Admin SDK en una función serverless.
 */
const CONCURRENCY = 8;

export interface DispatchResult {
  /** Alertas vencidas que se avisaron en esta corrida. */
  sent: number;
  /** Alertas que ya se habían avisado antes (la `dedupeKey` las frenó). */
  skipped: number;
  /** Alertas que fallaron. Se reintentan solas en la próxima corrida. */
  failed: number;
}

/**
 * Emite una notificación por cada nota cuya alerta venció y todavía no se
 * avisó.
 *
 * **La consulta es un rango sobre `alertAt`**, no un escaneo. Sólo bajan las
 * notas que vencen en la ventana `[ahora - 24h, ahora]`, de todos los usuarios
 * a la vez: una corrida en la que no venció nada no lee ningún documento. La
 * versión anterior filtraba por `hasAlert == true` y comparaba en memoria, o
 * sea que bajaba **todas** las notas con alerta de la base en cada corrida,
 * cada cinco minutos, para descartar casi todas.
 *
 * Al ser un rango sobre un solo campo le alcanza el índice automático de
 * Firestore: no hace falta declarar nada en `firestore.indexes.json`. Los
 * documentos con `alertAt: null` quedan afuera solos — Firestore ordena por
 * tipo antes que por valor, así que un `null` nunca cae dentro de un rango de
 * `Timestamp`.
 *
 * **Sin estado nuevo en la nota.** No se marca la nota como "ya avisada": la
 * idempotencia sale de la `dedupeKey` de `notify()`, que ya garantiza una sola
 * emisión por alerta. Un flag en la nota sería un segundo lugar donde guardar
 * lo mismo, con el riesgo de quedar desincronizado si el proceso se corta
 * entre el `notify()` y el `update()` — y encima obligaría a que un cron le
 * reescriba documentos al usuario.
 */
export async function dispatchNoteAlerts(at: Date = new Date()): Promise<DispatchResult> {
  const since = Timestamp.fromMillis(at.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const until = Timestamp.fromMillis(at.getTime());

  const snapshot = await collection(COLLECTIONS.notes)
    .where("alertAt", ">=", since)
    .where("alertAt", "<=", until)
    .orderBy("alertAt", "asc")
    .limit(MAX_PER_RUN)
    .get();

  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0 };

  /* En tandas de `CONCURRENCY`, con `allSettled`: una alerta que falla no
     puede llevarse puestas a las otras siete de su tanda ni cortar la corrida.
     La que falló no se pierde — como no se escribió su documento, la próxima
     corrida la vuelve a encontrar dentro de la ventana de 24h. */
  for (let index = 0; index < snapshot.docs.length; index += CONCURRENCY) {
    const batch = snapshot.docs.slice(index, index + CONCURRENCY);

    const settled = await Promise.allSettled(
      batch.map((doc) => {
        const note = withId(doc);
        return notify({
          userId: note.ownerId,
          topic: "notes.alert",
          title: "Recordatorio",
          description: note.text,
          href: ROUTES.inicio,
          /* Incluye el instante y no sólo el id: si el usuario mueve la alerta
             a otra hora, es un recordatorio distinto y tiene que volver a
             sonar. Con `note:{id}` a secas, la segunda alerta de la misma nota
             se perdería como "duplicada" para siempre. */
          dedupeKey: `note:${note.id}:${note.alertAt?.toMillis() ?? 0}`,
        });
      })
    );

    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        console.error("[dispatch] alerta de nota fallida", outcome.reason);
        result.failed += 1;
      } else if (outcome.value.duplicate) {
        result.skipped += 1;
      } else {
        result.sent += 1;
      }
    }
  }

  return result;
}
