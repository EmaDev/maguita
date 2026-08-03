"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppBadge, useAppLifecycle } from "lib-kit-components";
import { usePushResync } from "./use-push-resync";

/**
 * Mantiene al día la campana del shell cuando la notificación **no** la
 * disparó esta pestaña.
 *
 * Las notificaciones viajan como prop del layout (Server Component), así que
 * lo que emite una Server Action de esta misma pestaña ya se ve solo: su
 * `revalidatePath` refresca el layout. Lo que no se ve solo es todo lo demás —
 * un push del servidor, algo emitido desde otro dispositivo, o un cron que
 * corrió mientras la app estaba en segundo plano.
 *
 * Dos disparadores, ninguno con polling:
 *
 * 1. **El mensaje del service worker.** `sw.js` hace `postMessage` a todas las
 *    pestañas al recibir un `push`; acá eso se traduce en un `router.refresh()`,
 *    que vuelve a pedir el RSC del layout con la bandeja actualizada.
 * 2. **Volver a primer plano.** Un push que llegó con la app cerrada no
 *    encontró ninguna pestaña a la que avisarle. Al volver, refrescamos —
 *    pero sólo si estuvo abajo un rato, para no repetir el viaje cada vez que
 *    el usuario cambia de app por dos segundos.
 *
 * De paso monta `usePushResync`, que se ocupa de que la suscripción push no se
 * quede muerta en silencio (ver ese archivo).
 */

/** Mínimo en segundo plano para que justifique refrescar al volver. */
const MIN_HIDDEN_MS = 30_000;

export function NotificationSync({ unread }: { unread: number }) {
  const router = useRouter();

  // Si el permiso ya está dado pero la suscripción se perdió, la rehace sola.
  // Va acá porque este componente ya es el que se monta una vez por sesión con
  // el usuario logueado, que es exactamente cuándo tiene sentido revisarlo.
  usePushResync();

  // Contador en el ícono de la app instalada. `sw.js` también lo escribe al
  // recibir un push (para cuando la app está cerrada); acá se resincroniza con
  // el número real cada vez que el layout trae datos nuevos, que es lo que lo
  // baja de nuevo a cero cuando el usuario lee todo.
  useAppBadge(unread);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") router.refresh();
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  useAppLifecycle({
    onResume: (msHidden) => {
      if (msHidden >= MIN_HIDDEN_MS) router.refresh();
    },
  });

  return null;
}
