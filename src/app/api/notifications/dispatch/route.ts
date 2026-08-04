import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { dispatchHabitPenalties } from "@/lib/notifications/dispatch-habit-penalties";
import { dispatchHabitReminders } from "@/lib/notifications/dispatch-habit-reminders";
import { dispatchNoteAlerts } from "@/lib/notifications/dispatch-note-alerts";

/**
 * Disparador de las notificaciones que dependen del reloj y no de un click.
 *
 * Pensado para que lo llame un cron cada 5-15 minutos:
 *
 * ```
 * curl -X POST https://<host>/api/notifications/dispatch \
 *   -H "Authorization: Bearer $NOTIFICATIONS_CRON_SECRET"
 * ```
 *
 * Es el punto donde se enchufa cualquier emisor programado futuro: la mini-app
 * exporta una función como `dispatchNoteAlerts` y se suma acá.
 *
 * **Por qué un route handler y no una Server Action**: las Server Actions
 * asumen una sesión de usuario, y acá no hay ninguna — el que llama es una
 * máquina, y se autentica con un secreto compartido.
 */

/** Sin `NOTIFICATIONS_CRON_SECRET` configurado el endpoint queda cerrado, no abierto. */
const secret = process.env.NOTIFICATIONS_CRON_SECRET ?? "";

/**
 * Nunca prerenderizar ni cachear: cada corrida tiene que mirar el reloj y
 * Firestore de verdad. Sin esto, Next podría servir el resultado de la primera
 * corrida para siempre.
 */
export const dynamic = "force-dynamic";

/**
 * Techo de ejecución. Una corrida procesa hasta 100 alertas de a 8 en
 * paralelo, y cada una espera a Firestore y al push service; el default de
 * Vercel (10s en Hobby) las cortaría a la mitad. 60s es el máximo que admite
 * el plan Hobby — en Pro se puede subir, pero si una corrida llega a tardar
 * eso, lo que hay que bajar es `MAX_PER_RUN`, no el techo.
 */
export const maxDuration = 60;

/**
 * Comparación en tiempo constante. Con un `===` común, el tiempo de respuesta
 * filtra cuántos caracteres del secreto acertó quien está probando.
 */
function isAuthorized(request: NextRequest): boolean {
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  // `timingSafeEqual` exige buffers del mismo largo; el largo del secreto no es
  // información sensible, así que cortar acá no filtra nada útil.
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const [notes, habitReminders, habitPenalties] = await Promise.all([
      dispatchNoteAlerts(),
      dispatchHabitReminders(),
      dispatchHabitPenalties(),
    ]);
    return Response.json({ ok: true, notes, habitReminders, habitPenalties });
  } catch (error) {
    console.error("[dispatch] falló la corrida", error);
    // 500 para que el cron lo cuente como fallo y reintente en la próxima
    // ventana en vez de darlo por bueno.
    return Response.json({ error: "Falló el envío programado." }, { status: 500 });
  }
}
