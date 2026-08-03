"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Switch,
  Textarea,
  useSnackbar,
} from "lib-kit-components";
import { SectionTitle } from "@/components/molecules/SectionTitle";
import { ROUTES } from "@/lib/app-config";
import type { NotificationsDebugState } from "@/lib/data/debug";
import {
  debugDispatchNoteAlertsAction,
  debugNotifyAction,
} from "@/lib/data/debug-actions";
import {
  NOTIFICATION_TOPIC_IDS,
  topicOf,
  type NotificationTopicId,
} from "@/lib/notifications/topics";

/**
 * Herramienta de notificaciones de `/debug`: emitir una a mano, ver por qué
 * salió o no salió, y correr el emisor programado sin esperar al cron.
 *
 * Emite por `notify()`, el mismo camino que usan los módulos — no un atajo que
 * escriba el documento a mano. Si acá llega, llega en producción: pasa por las
 * preferencias, el horario de silencio, el dedupe y el push reales.
 */

/** El resultado crudo de la última emisión, para mostrarlo tal cual. */
type LastResult = { label: string; detail: string; ok: boolean } | null;

export function NotificationsDebugTool({ state }: { state: NotificationsDebugState }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [topic, setTopic] = useState<NotificationTopicId>(NOTIFICATION_TOPIC_IDS[0]!);
  const [title, setTitle] = useState("Probando el sistema");
  const [description, setDescription] = useState(
    "Si ves esto en la campana y en el celular, el camino completo funciona."
  );
  const [href, setHref] = useState<string>(ROUTES.inicio);
  const [dedupeKey, setDedupeKey] = useState("");
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<LastResult>(null);

  function emit() {
    startTransition(async () => {
      try {
        const emitted = await debugNotifyAction({
          topic,
          title,
          description,
          href,
          dedupeKey,
          force,
        });

        /* El detalle es el valor de la herramienta: "no pasó nada" tiene tres
           causas muy distintas y sin esto no se distinguen. */
        const detail = emitted.duplicate
          ? `Descartada por duplicada — ya existe una emisión con esa dedupeKey (id ${emitted.id.slice(0, 8)}…).`
          : emitted.pushSkipped === "muted"
            ? "Entrada creada en la campana. El push no salió: apagado por preferencias."
            : emitted.pushSkipped === "quiet-hours"
              ? "Entrada creada en la campana. El push no salió: horario de silencio."
              : emitted.pushed > 0
                ? `Entrada creada y push entregado a ${emitted.pushed} dispositivo${emitted.pushed === 1 ? "" : "s"}.`
                : "Entrada creada. Ningún dispositivo tiene el push activo.";

        setResult({ label: "Emitida", detail, ok: !emitted.duplicate });
        snack({ message: "Notificación emitida.", variant: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falló la emisión.";
        setResult({ label: "Error", detail: message, ok: false });
        snack({ message, variant: "error" });
      }
    });
  }

  function runDispatch() {
    startTransition(async () => {
      try {
        const { sent, skipped, failed } = await debugDispatchNoteAlertsAction();
        setResult({
          label: "Dispatch",
          detail: `${sent} enviada(s), ${skipped} ya avisada(s), ${failed} fallida(s).`,
          ok: failed === 0,
        });
        snack({ message: `Dispatch corrido: ${sent} enviada(s).`, variant: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falló el dispatch.";
        setResult({ label: "Error", detail: message, ok: false });
        snack({ message, variant: "error" });
      }
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Estado</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-2 text-sm">
          <Row
            label="Claves VAPID"
            value={
              state.pushConfigured
                ? `configuradas (${state.publicKeyPreview})`
                : "faltan — el push no sale"
            }
            ok={state.pushConfigured}
          />
          <Row
            label="Secreto del cron"
            value={state.cronSecretSet ? "configurado" : "falta — el endpoint da 401"}
            ok={state.cronSecretSet}
          />
          <Row
            label="Dispositivos con push"
            value={String(state.devices.length)}
            ok={state.devices.length > 0}
          />
          <Row
            label="Push de la cuenta"
            value={state.pushEnabled ? "activado" : "apagado (interruptor maestro)"}
            ok={state.pushEnabled}
          />
          <Row
            label="Horario de silencio"
            value={
              state.quietNow
                ? `activo ahora (${state.timeZone ?? "sin zona"})`
                : "no activo"
            }
            ok={!state.quietNow}
          />
          {state.mutedTopics.length > 0 && (
            <Row
              label="Topics silenciados"
              value={state.mutedTopics.join(", ")}
              ok={false}
            />
          )}
          <Row label="No leídas" value={String(state.unread)} ok />
        </Card>
      </section>

      <section>
        <SectionTitle>Emitir una notificación</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-3">
          <Select
            label="Topic"
            value={topic}
            onChange={(value: string) => setTopic(value as NotificationTopicId)}
            /* Las opciones salen del registro: un topic nuevo aparece acá solo,
               igual que en la pantalla de preferencias. */
            options={NOTIFICATION_TOPIC_IDS.map((id) => ({
              value: id,
              label: `${id} — ${topicOf(id).label}`,
            }))}
          />
          <p className="text-xs text-muted">
            Tono <code>{topicOf(topic).tone}</code>
            {topicOf(topic).required
              ? " · no se puede silenciar por topic"
              : topicOf(topic).pushByDefault
                ? " · push activado por defecto"
                : " · push apagado por defecto"}
          </p>

          <Input
            label="Título"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          />
          <Textarea
            label="Descripción"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            rows={2}
            autoResize
          />
          <Input
            label="href"
            value={href}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHref(e.target.value)}
            hint="Ruta interna a la que lleva tocarla."
          />
          <Input
            label="dedupeKey"
            value={dedupeKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDedupeKey(e.target.value)}
            placeholder="vacío = cada emisión es una nueva"
            hint="Con la misma clave, la segunda emisión se descarta. Sirve para probar la idempotencia."
          />
          <Switch
            checked={force}
            onChange={setForce}
            label="force"
            description="Saltea preferencias y horario de silencio, como hace la notificación de prueba de Ajustes."
          />

          <Button fullWidth onClick={emit} loading={pending} disabled={!title.trim()}>
            Emitir
          </Button>
        </Card>
      </section>

      <section>
        <SectionTitle>Alertas de notas</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            Corre el mismo emisor programado que dispara el cron
            (<code>dispatchNoteAlerts</code>), pero ahora. Toma las alertas
            vencidas en las últimas 24 horas que todavía no se avisaron.
          </p>
          <Button variant="outline" fullWidth onClick={runDispatch} loading={pending}>
            Correr el dispatch ahora
          </Button>

          {state.alerts.length === 0 ? (
            <p className="text-sm text-muted">Esta cuenta no tiene notas con alerta.</p>
          ) : (
            <ul className="space-y-2 border-t border-border pt-3">
              {state.alerts.map((alert) => (
                <li key={alert.id} className="text-sm">
                  <p className="truncate">{alert.text}</p>
                  <p className="text-xs text-muted">
                    {alert.alertDate} {alert.alertTime}
                    {alert.alertAtMs === null ? (
                      /* Notas guardadas antes de que existiera `alertAt`: el
                         cron consulta por ese campo, así que no las ve. */
                      <span className="text-danger">
                        {" "}
                        · sin alertAt — el cron no la ve, volvé a guardarla
                      </span>
                    ) : (
                      ` · ${new Date(alert.alertAtMs).toLocaleString("es-AR")}`
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {result && (
        <section>
          <SectionTitle>Último resultado</SectionTitle>
          <Card variant="outline" padding="md">
            <p className={`text-sm font-medium ${result.ok ? "text-success" : "text-danger"}`}>
              {result.label}
            </p>
            <p className="text-sm text-muted leading-relaxed">{result.detail}</p>
          </Card>
        </section>
      )}
    </div>
  );
}

/** Fila del diagnóstico: etiqueta, valor y un punto de color que se lee de un vistazo. */
function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium">
        {value}
        <span
          aria-hidden
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-success" : "bg-danger"}`}
        />
      </span>
    </div>
  );
}
