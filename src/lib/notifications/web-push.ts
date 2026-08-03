import "server-only";
import webpush, { WebPushError } from "web-push";
import type { PushSubscriptionDoc } from "@/lib/firebase/collections";

/**
 * Envío de Web Push con VAPID.
 *
 * Es el protocolo estándar del navegador (`PushManager.subscribe`), **no**
 * Firebase Cloud Messaging: el service worker (`public/sw.js`) ya escucha el
 * evento `push` crudo y `usePushSubscription` del kit crea la suscripción con
 * la clave pública VAPID, así que el camino directo no necesita ninguna capa
 * de FCM en el medio. FCM además sólo entrega la clave **pública** del par en
 * la consola de Firebase — sin la privada no se puede firmar el JWT de VAPID
 * desde nuestro server, que es justo lo que hace falta acá. Por eso el par de
 * claves lo generamos nosotros (`yarn vapid`) y vive en el `.env`.
 *
 * `web-push` se ocupa del cifrado del payload (aes128gcm) y de firmar el JWT;
 * este módulo aporta la configuración, la forma del payload que espera el
 * service worker, y la clasificación del resultado.
 */

/** Lo que `sw.js` espera adentro de `event.data.json()`. */
export interface PushPayload {
  title: string;
  body: string;
  /** Ruta interna que abre `notificationclick`. */
  url: string;
  /**
   * Agrupa notificaciones en la bandeja del sistema: una `tag` repetida
   * reemplaza a la anterior en vez de apilar dos avisos del mismo evento.
   */
  tag?: string;
  /** Cantidad de no leídas tras este aviso, para el badge del ícono de la app. */
  badgeCount?: number;
}

/**
 * Resultado de un envío. `gone` es el caso importante: el push service
 * responde 404/410 cuando el navegador desinstaló la PWA, limpió sus datos o
 * revocó el permiso — esa suscripción no vuelve nunca, hay que borrarla.
 */
export type PushResult = "sent" | "gone" | "failed";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
/**
 * Identifica a quién reclamarle si nuestros envíos molestan al push service.
 * El estándar pide un `mailto:` o una URL; sin uno válido, algunos servicios
 * rechazan el JWT.
 */
const subject = process.env.VAPID_SUBJECT ?? "mailto:emanuel00developer@gmail.com";

/**
 * `true` si hay par de claves configurado. Sin esto la app funciona igual —
 * las notificaciones quedan sólo en el panel — en vez de explotar en el primer
 * `notify()`, mismo criterio que `isFirebaseConfigured`.
 */
export const isPushConfigured = Boolean(publicKey && privateKey);

let configured = false;

/**
 * `setVapidDetails` valida el formato de las claves y tira si están mal, así
 * que se llama en el primer envío y no al importar el módulo: un `.env` a
 * medias no tiene por qué romper el build ni el render de una pantalla que no
 * manda ningún push.
 */
function ensureConfigured(): void {
  if (configured) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

let warnedNotConfigured = false;

/**
 * Sin claves, `sendWebPush` devolvía `"failed"` **en silencio**: el envío no
 * salía y no quedaba ni una línea en el log, así que "no me llega el push" no
 * tenía ningún rastro que seguir. Avisa una sola vez por proceso — es un
 * problema de configuración, no de cada envío, y repetirlo por dispositivo y
 * por notificación sólo taparía el resto del log.
 */
function warnNotConfigured(): void {
  if (warnedNotConfigured) return;
  warnedNotConfigured = true;
  console.warn(
    "[push] no hay par de claves VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / " +
      "VAPID_PRIVATE_KEY): las notificaciones quedan sólo en la campana. " +
      "Generalas con `yarn vapid`."
  );
}

/**
 * Manda un push a una suscripción. **No tira**: un dispositivo caído no puede
 * hacer fallar la Server Action que emitió la notificación (el usuario estaba
 * cargando un gasto, no administrando sus dispositivos). El que llama decide
 * qué hacer con cada resultado — ver `deliverPush` en `notify.ts`.
 */
export async function sendWebPush(
  subscription: Pick<PushSubscriptionDoc, "endpoint" | "p256dh" | "auth">,
  payload: PushPayload
): Promise<PushResult> {
  if (!isPushConfigured) {
    warnNotConfigured();
    return "failed";
  }

  try {
    ensureConfigured();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      // 4 horas: si el dispositivo estuvo apagado más que eso, el aviso ya no
      // es noticia y el panel lo tiene igual. TTL 0 lo descartaría apenas el
      // dispositivo no esté conectado en ese instante.
      { TTL: 60 * 60 * 4, urgency: "normal" }
    );
    return "sent";
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      return "gone";
    }
    console.error("[push] envío fallido", error);
    return "failed";
  }
}
