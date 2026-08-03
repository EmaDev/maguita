"use client";

import { useEffect } from "react";
import { savePushSubscriptionAction } from "@/lib/data/notifications-actions";

/**
 * Mantiene viva la suscripción push de este dispositivo, sin molestar al
 * usuario.
 *
 * El permiso del navegador y la suscripción son cosas distintas y se pueden
 * desincronizar: el permiso queda concedido para siempre, pero la suscripción
 * puede desaparecer sola —el navegador la rota, se borran los datos del sitio,
 * o se concedió el permiso sin llegar a crearla— y cuando pasa, los push dejan
 * de llegar **sin ninguna señal**: la campana sigue andando, así que desde
 * afuera parece que todo funciona.
 *
 * Este hook cierra ese hueco: si el permiso ya está dado, se asegura de que
 * exista una suscripción y de que el server la tenga guardada.
 *
 * Tres reglas que lo hacen seguro de correr en cada carga:
 *
 * 1. **Nunca pide permiso.** Si `Notification.permission` no es `"granted"`,
 *    no hace nada. Pedirlo sin un gesto del usuario es lo que hace que la
 *    gente bloquee las notificaciones de por vida — y `subscribe()` con el
 *    permiso en `"default"` dispararía justamente ese prompt.
 * 2. **Una vez por sesión del navegador.** Sin la marca, cada navegación con
 *    recarga completa escribiría de nuevo en Firestore para no cambiar nada.
 *    Que sea `sessionStorage` y no `localStorage` es a propósito: si el server
 *    perdiera la fila, la próxima sesión la vuelve a crear igual.
 * 3. **No falla hacia afuera.** Cualquier error queda en un `console.warn`.
 *    Es una tarea de fondo: que no se pueda resincronizar no puede romper la
 *    pantalla que el usuario está mirando, ni mostrarle un cartel de algo que
 *    él no pidió.
 */

const SESSION_FLAG = "maguita:push-synced";

export function usePushResync(): void {
  useEffect(() => {
    /* La clave pública se lee directo del entorno y no baja como prop desde el
       layout: es `NEXT_PUBLIC_` (viaja en cada `pushManager.subscribe`, o sea
       que es pública por definición) y enhebrarla por AppShell → AppFrame →
       NotificationSync sería ruido por un valor que el bundle ya tiene. */
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
    if (!publicKey) return;

    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return;
    if (Notification.permission !== "granted") return;

    try {
      if (sessionStorage.getItem(SESSION_FLAG) === "1") return;
    } catch {
      /* Safari en privado tira al tocar sessionStorage: sin marca, se
         resincroniza en cada carga. Es más trabajo del necesario, no un error. */
    }

    let cancelled = false;

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        /* Si ya hay suscripción se reusa (y se re-guarda, que es lo que cura el
           caso "el navegador la tiene y el server la perdió"). Si no hay, se
           crea: con el permiso ya concedido, `subscribe()` no abre ningún
           prompt. */
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }));

        if (cancelled) return;

        const { keys } = subscription.toJSON() as {
          keys?: { p256dh?: string; auth?: string };
        };
        if (!keys?.p256dh || !keys.auth) return;

        await savePushSubscriptionAction({
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          timeZone: deviceTimeZone(),
          userAgent: navigator.userAgent,
        });

        try {
          sessionStorage.setItem(SESSION_FLAG, "1");
        } catch {
          /* Ver arriba. */
        }
      } catch (error) {
        console.warn("[push] no se pudo resincronizar la suscripción", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}

/** Zona horaria IANA del dispositivo, para el horario de silencio. */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * La clave VAPID viaja en base64 url-safe, pero `applicationServerKey` espera
 * los bytes crudos. El kit hace esta misma conversión adentro de
 * `usePushSubscription`, pero no la exporta.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);

  /* El `ArrayBuffer` se crea explícito en vez de `new Uint8Array(largo)`: ese
     atajo devuelve `Uint8Array<ArrayBufferLike>`, que incluye
     `SharedArrayBuffer` y por eso no encaja en el `BufferSource` que pide
     `applicationServerKey`. */
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}
