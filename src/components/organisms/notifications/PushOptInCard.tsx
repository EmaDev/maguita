"use client";

import { useCallback } from "react";
import {
  Button,
  Card,
  useNotificationPermission,
  usePushSubscription,
  useSnackbar,
} from "lib-kit-components";
import { BellIcon } from "@/components/atoms/icons";
import { APP_NAME } from "@/lib/app-config";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/lib/data/notifications-actions";

/**
 * Alta/baja del push **en este dispositivo**.
 *
 * Es por dispositivo y no por cuenta: la suscripción la emite el navegador y
 * vale sólo para él, así que activar el push en la compu no hace que llegue al
 * celular. Esa es también la razón por la que este estado no sale del server —
 * `usePushSubscription` lo lee del propio `pushManager` al montar, que es la
 * única fuente que sabe si *este* navegador está suscripto.
 */

/** Zona horaria IANA del dispositivo, para el horario de silencio. */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function PushOptInCard({ publicKey }: { publicKey: string }) {
  const { snack } = useSnackbar();
  const permission = useNotificationPermission();

  /* Las dos Server Actions son los callbacks del hook, no llamadas sueltas
     después: `onSubscribe` corre con la suscripción ya creada y `onUnsubscribe`
     **antes** de destruirla, que es el último instante en que todavía se
     conoce el endpoint con el que está guardada en Firestore. */
  const push = usePushSubscription({
    publicKey,
    onSubscribe: async (subscription) => {
      const { keys } = subscription.toJSON() as {
        keys?: { p256dh?: string; auth?: string };
      };
      await savePushSubscriptionAction({
        endpoint: subscription.endpoint,
        p256dh: keys?.p256dh ?? "",
        auth: keys?.auth ?? "",
        timeZone: deviceTimeZone(),
        userAgent: navigator.userAgent,
      });
    },
    onUnsubscribe: (subscription) => deletePushSubscriptionAction(subscription.endpoint),
  });

  /*
   * `subscribe()`/`unsubscribe()` **no tiran**: el hook atrapa el error
   * adentro, lo deja en `push.error` y devuelve `null`. Por eso acá no hay
   * try/catch — sería código muerto — y el mensaje de falla se arma con
   * `push.error`, que es lo único que dice *por qué* falló (permiso denegado,
   * service worker no listo, clave VAPID inválida). Tragarlo detrás de un
   * "no se pudo activar" deja al usuario sin nada que hacer al respecto.
   */
  const toggle = useCallback(async () => {
    if (push.subscribed) {
      await push.unsubscribe();
      snack({ message: "Este dispositivo ya no va a recibir avisos.", variant: "info" });
      return;
    }

    const subscription = await push.subscribe();
    snack(
      subscription
        ? { message: "Listo, vas a recibir avisos en este dispositivo.", variant: "success" }
        : {
            message: push.error
              ? `No se pudo activar: ${push.error}`
              : "No se pudo activar el push.",
            variant: "error",
          }
    );
  }, [push, snack]);

  /* El navegador no deja volver a pedir un permiso ya denegado: el botón no
     va a funcionar nunca hasta que se lo reponga a mano desde el candado de la
     barra de direcciones. Sin este aviso, el botón "no hace nada". */
  const blocked = permission.status === "denied";

  if (!push.supported) {
    return (
      <Card variant="outline" padding="md">
        <p className="text-sm text-muted leading-relaxed">
          Este navegador no soporta notificaciones push. Vas a seguir viendo los avisos
          en la campana de {APP_NAME} cuando abras la app.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="outline" padding="md" className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 grid place-items-center w-10 h-10 rounded-full ${
            push.subscribed ? "bg-primary/12 text-primary" : "bg-surface-alt text-muted"
          }`}
        >
          <BellIcon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            {push.subscribed ? "Avisos activos en este dispositivo" : "Avisos en este dispositivo"}
          </p>
          <p className="text-sm text-muted leading-relaxed">
            {push.subscribed
              ? "Te llegan aunque tengas la app cerrada."
              : `Activalos para que ${APP_NAME} pueda avisarte con la app cerrada.`}
          </p>
        </div>
      </div>

      <Button
        variant={push.subscribed ? "outline" : "primary"}
        fullWidth
        onClick={toggle}
        disabled={push.busy || (blocked && !push.subscribed)}
      >
        {push.busy
          ? "Un momento…"
          : push.subscribed
            ? "Desactivar en este dispositivo"
            : "Activar en este dispositivo"}
      </Button>

      {blocked && !push.subscribed && (
        <p className="text-xs text-danger leading-relaxed">
          Bloqueaste las notificaciones para este sitio. Habilitalas desde el candado de
          la barra de direcciones y volvé a intentar — el navegador no deja que la página
          las vuelva a pedir.
        </p>
      )}

      {/* El error del hook queda a la vista y no sólo en un snackbar que se va:
          es lo único que dice por qué no se pudo activar. */}
      {push.error && !push.subscribed && (
        <p className="text-xs text-danger leading-relaxed">Último error: {push.error}</p>
      )}

      {/* En iOS el permiso sólo existe con la PWA instalada: sin el aviso, el
          botón simplemente "no hace nada" y no hay forma de saber por qué. */}
      <p className="text-xs text-muted leading-relaxed">
        En iPhone y iPad las notificaciones sólo funcionan con {APP_NAME} instalada desde
        el menú «Compartir → Agregar a inicio».
      </p>
    </Card>
  );
}
