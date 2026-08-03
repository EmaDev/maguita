"use client";

import { useState, useTransition } from "react";
import { Button, Card, Switch, TimePicker, useSnackbar } from "lib-kit-components";
import { BellIcon, TrashIcon } from "@/components/atoms/icons";
import { SectionTitle } from "@/components/molecules/SectionTitle";
import { APP_NAME } from "@/lib/app-config";
import type { PushDevice } from "@/lib/data/notifications";
import {
  deletePushDeviceAction,
  resetNotificationPreferencesAction,
  sendTestNotificationAction,
  updateNotificationPreferencesAction,
} from "@/lib/data/notifications-actions";
import type { ResolvedNotificationPreferences } from "@/lib/notifications/preferences";
import { isWithinQuietHours } from "@/lib/notifications/quiet-hours";
import {
  NOTIFICATION_GROUPS,
  topicOf,
  topicsOfGroup,
  type NotificationTopicId,
} from "@/lib/notifications/topics";
import { PushOptInCard } from "./PushOptInCard";

/**
 * Pantalla de preferencias de notificación.
 *
 * Los interruptores por tipo salen del **registro de topics**, no de una lista
 * escrita acá: una mini-app que agregue su topic aparece sola en la sección de
 * su grupo, sin tocar este archivo. Por eso las secciones se recorren desde
 * `NOTIFICATION_GROUPS` y las filas desde `topicsOfGroup`.
 *
 * Todo lo que se ve gobierna sólo el **push**. La entrada en la campana se
 * escribe siempre — ver el comentario de `topics.ts` sobre por qué el panel no
 * se puede silenciar.
 */

/** Zona horaria IANA del dispositivo, la que se guarda al tocar cualquier preferencia. */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function NotificationSettings({
  publicKey,
  preferences: initialPreferences,
  devices,
}: {
  /** Clave pública VAPID. Vacía = el server no tiene el par configurado. */
  publicKey: string;
  preferences: ResolvedNotificationPreferences;
  devices: PushDevice[];
}) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  /* El estado vive acá y no en `useOptimistic`: a diferencia del panel de la
     campana, esta pantalla es un formulario que el usuario recorre entero
     tocando varios interruptores seguidos, y cada guardado devuelve el estado
     ya resuelto por el server (mismo criterio que `ExpenseCategoriesSheet`). */
  const [preferences, setPreferences] = useState(initialPreferences);

  /** Guarda el estado completo. Los interruptores no tienen botón de "aplicar": cada toque persiste. */
  function save(next: ResolvedNotificationPreferences) {
    const previous = preferences;
    setPreferences(next);
    startTransition(async () => {
      try {
        setPreferences(
          await updateNotificationPreferencesAction({
            pushEnabled: next.pushEnabled,
            push: next.push,
            quietHours: next.quietHours,
            // La zona se refresca en cada guardado: el usuario puede haber
            // viajado desde la última vez, y el horario de silencio se evalúa
            // contra ella del lado del server.
            timeZone: deviceTimeZone(),
          })
        );
      } catch {
        setPreferences(previous);
        snack({ message: "No pudimos guardar el cambio.", variant: "error" });
      }
    });
  }

  const quietNow = isWithinQuietHours(preferences.quietHours, deviceTimeZone());

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Este dispositivo</SectionTitle>
        {publicKey ? (
          <PushOptInCard publicKey={publicKey} />
        ) : (
          <Card variant="outline" padding="md">
            <p className="text-sm text-muted leading-relaxed">
              El push todavía no está configurado en el servidor. Los avisos van a
              seguir apareciendo en la campana de {APP_NAME}.
            </p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Push</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-4">
          <Switch
            checked={preferences.pushEnabled}
            onChange={(pushEnabled: boolean) => save({ ...preferences, pushEnabled })}
            label="Recibir avisos push"
            description="Apagado, no sale ningún push a ninguno de tus dispositivos. La campana sigue funcionando igual."
          />

          <div className="border-t border-border pt-4 space-y-4">
            <Switch
              checked={preferences.quietHours.enabled}
              onChange={(enabled: boolean) =>
                save({
                  ...preferences,
                  quietHours: { ...preferences.quietHours, enabled },
                })
              }
              label="Horario de silencio"
              description="Dentro de esta franja no te llega ningún push. Lo que pase queda igual en la campana."
            />

            {preferences.quietHours.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    label="Desde"
                    value={preferences.quietHours.from}
                    onChange={(from: string | null) =>
                      from &&
                      save({
                        ...preferences,
                        quietHours: { ...preferences.quietHours, from },
                      })
                    }
                    step={30}
                  />
                  <TimePicker
                    label="Hasta"
                    value={preferences.quietHours.to}
                    onChange={(to: string | null) =>
                      to &&
                      save({
                        ...preferences,
                        quietHours: { ...preferences.quietHours, to },
                      })
                    }
                    step={30}
                  />
                </div>
                {quietNow && (
                  <p className="text-xs text-muted">
                    Ahora mismo estás dentro del horario de silencio.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </section>

      {/* Una sección por grupo del registro. Los grupos sin topics no se
          renderizan: un módulo puede declarar su grupo antes que sus topics. */}
      {NOTIFICATION_GROUPS.map((group) => {
        const topics = topicsOfGroup(group.id);
        if (topics.length === 0) return null;

        return (
          <section key={group.id}>
            <SectionTitle>{group.label}</SectionTitle>
            <Card variant="outline" padding="md" className="space-y-4">
              {topics.map((id) => (
                <TopicSwitch
                  key={id}
                  id={id}
                  checked={preferences.push[id]}
                  // El maestro apagado deja las filas visibles pero inertes:
                  // esconderlas haría desaparecer la configuración justo
                  // cuando el usuario quiere entender por qué no le llega nada.
                  disabled={!preferences.pushEnabled}
                  onChange={(push) =>
                    save({ ...preferences, push: { ...preferences.push, [id]: push } })
                  }
                />
              ))}
            </Card>
          </section>
        );
      })}

      {devices.length > 0 && (
        <section>
          <SectionTitle>Dispositivos con push</SectionTitle>
          <Card variant="outline" padding="md" className="space-y-3">
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Probar</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            Manda un aviso de prueba a tu cuenta. Ignora tus preferencias y el horario
            de silencio a propósito: la idea es comprobar que el camino funciona.
          </p>
          <Button
            variant="outline"
            fullWidth
            onClick={() =>
              startTransition(async () => {
                try {
                  const { pushed } = await sendTestNotificationAction();
                  snack({
                    message:
                      pushed > 0
                        ? `Aviso enviado a ${pushed} dispositivo${pushed === 1 ? "" : "s"}.`
                        : "Aviso creado en la campana. Ningún dispositivo tiene el push activo.",
                    variant: "success",
                  });
                } catch {
                  snack({ message: "No se pudo enviar la prueba.", variant: "error" });
                }
              })
            }
            disabled={pending}
          >
            Enviar notificación de prueba
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={() =>
              startTransition(async () => {
                try {
                  setPreferences(await resetNotificationPreferencesAction());
                  snack({ message: "Preferencias restablecidas.", variant: "success" });
                } catch {
                  snack({ message: "No pudimos restablecerlas.", variant: "error" });
                }
              })
            }
            disabled={pending}
          >
            Restablecer preferencias
          </Button>
        </Card>
      </section>
    </div>
  );
}

/** Una fila del registro de topics. El label y la bajada salen del propio registro. */
function TopicSwitch({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: NotificationTopicId;
  checked: boolean;
  disabled: boolean;
  onChange: (push: boolean) => void;
}) {
  const topic = topicOf(id);
  const required = Boolean(topic.required);

  return (
    <Switch
      checked={required ? true : checked}
      onChange={onChange}
      // Los `required` no se pueden apagar de a uno: el interruptor maestro es
      // el único que los alcanza, y así se ve por qué está trabado.
      disabled={disabled || required}
      label={topic.label}
      description={
        required ? `${topic.description} No se pueden desactivar.` : topic.description
      }
    />
  );
}

/**
 * Un navegador suscripto. El `userAgent` no se muestra crudo — es ilegible y
 * expone más de lo que hace falta para reconocer "la compu del trabajo".
 */
function DeviceRow({ device }: { device: PushDevice }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-surface-alt text-muted">
        <BellIcon className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{describeDevice(device.userAgent)}</p>
        <p className="text-xs text-muted">
          Desde el {new Date(device.createdAt).toLocaleDateString("es-AR")}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Quitar este dispositivo"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await deletePushDeviceAction(device.id);
              snack({ message: "Dispositivo quitado.", variant: "success" });
            } catch {
              snack({ message: "No pudimos quitarlo.", variant: "error" });
            }
          })
        }
      >
        <TrashIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}

/**
 * Resume un `userAgent` a "Navegador en Sistema". Es un heurístico a propósito:
 * sólo tiene que alcanzar para distinguir un dispositivo de otro en una lista
 * de dos o tres, no para identificar el navegador con precisión.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido";

  // Orden importante: Edge y Chrome se anuncian como Safari, y Edge como Chrome.
  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : "Navegador";

  const system =
    /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent) ? "iOS"
    : /Windows/.test(userAgent) ? "Windows"
    : /Mac OS X/.test(userAgent) ? "Mac"
    : /Linux/.test(userAgent) ? "Linux"
    : null;

  return system ? `${browser} en ${system}` : browser;
}
