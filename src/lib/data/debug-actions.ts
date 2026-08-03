"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { assertDevTools } from "@/lib/dev-tools";
import {
  dispatchNoteAlerts,
  type DispatchResult,
} from "@/lib/notifications/dispatch-note-alerts";
import { notify, type NotifyResult } from "@/lib/notifications/notify";
import { isNotificationTopicId, type NotificationTopicId } from "@/lib/notifications/topics";

/**
 * Herramientas de desarrollo de `/debug`.
 *
 * **Cada acción llama a `assertDevTools()` antes que a nada.** Una Server
 * Action es un endpoint público desde el momento en que se exporta: que la
 * pantalla esté escondida no la esconde a ella. El gate de la pantalla y el de
 * cada acción son dos chequeos distintos y los dos hacen falta.
 *
 * **Todo apunta a la propia cuenta.** Ninguna acción recibe un `userId`: se usa
 * siempre el de la sesión. Es lo que hace falta para probar, y evita que una
 * herramienta de desarrollo se convierta en una forma de mandarle
 * notificaciones a cualquiera pasándole un uid.
 */

export interface DebugNotifyInput {
  topic: string;
  title: string;
  description?: string;
  href?: string;
  dedupeKey?: string;
  force?: boolean;
}

/**
 * Emite una notificación real a la cuenta actual, por el mismo camino que
 * usan los módulos (`notify()`) — no un atajo que escriba el documento a mano.
 * Si esto funciona, funciona el sistema entero: preferencias, horario de
 * silencio, dedupe y push incluidos.
 *
 * Devuelve el `NotifyResult` completo, que es la mitad del valor de la
 * herramienta: dice si se descartó por duplicada, si el push se saltó por
 * preferencias o por silencio, y a cuántos dispositivos llegó.
 */
export async function debugNotifyAction(input: DebugNotifyInput): Promise<NotifyResult> {
  assertDevTools();
  const session = await requireSession(ROUTES.debug);

  if (!isNotificationTopicId(input.topic)) {
    throw new Error(`El topic "${input.topic}" no existe en el registro.`);
  }
  const title = input.title.trim();
  if (!title) throw new Error("Poné un título.");

  const result = await notify({
    userId: session.sub,
    topic: input.topic as NotificationTopicId,
    title,
    description: input.description?.trim() || null,
    href: input.href?.trim() || null,
    dedupeKey: input.dedupeKey?.trim() || undefined,
    force: input.force,
  });

  // La campana vive en el layout raíz, no en una ruta: se revalida ese.
  revalidatePath("/", "layout");
  return result;
}

/**
 * Corre el emisor programado en el acto, sin esperar al cron.
 *
 * Es la única forma de probar el camino de las alertas de notas antes de tener
 * el scheduler configurado — y después, de verificar que una alerta puntual
 * entra en la ventana sin quedarse mirando el reloj quince minutos.
 */
export async function debugDispatchNoteAlertsAction(): Promise<DispatchResult> {
  assertDevTools();
  await requireSession(ROUTES.debug);

  const result = await dispatchNoteAlerts();
  revalidatePath("/", "layout");
  return result;
}
