/**
 * Horario de silencio: la franja diaria en la que no sale ningún push.
 *
 * Módulo puro (sin `server-only` ni `"use client"`): lo evalúa el emisor en el
 * server y lo usa la pantalla de preferencias para avisar "ahora estarías en
 * silencio", así que los dos tienen que hacer la misma cuenta.
 *
 * Sólo frena el **push**. La entrada del panel se escribe igual: el panel no
 * interrumpe a nadie, y a la mañana siguiente el usuario quiere encontrar lo
 * que pasó de madrugada.
 */

export interface QuietHours {
  enabled: boolean;
  /** `HH:mm`, hora local del usuario. */
  from: string;
  /** `HH:mm`. Puede ser menor que `from`: la franja cruza la medianoche. */
  to: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  from: "22:00",
  to: "08:00",
};

/** `HH:mm` bien formado y con valores de reloj reales. */
export function isValidTimeOfDay(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Hora local (`HH:mm`) de un instante en una zona IANA. Devuelve `null` si la
 * zona no existe — un `timeZone` guardado hace meses puede haber desaparecido
 * de la base de datos de husos, y en ese caso preferimos no silenciar nada.
 *
 * Exportada: la usan también los jobs de hábitos (`dispatch-habit-*.ts`) para
 * comparar la hora local del dueño contra `alertTime`, mismo truco que acá.
 */
export function localTimeIn(timeZone: string, at: Date): string | null {
  try {
    // `en-GB` da reloj de 24 horas con cero a la izquierda ("07:05"), que es
    // exactamente el formato en que se guardan `from`/`to` — así la comparación
    // es un `<` de strings, sin parsear a minutos.
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
  } catch {
    return null;
  }
}

/**
 * Día local (`yyyy-mm-dd`) de un instante en una zona IANA. `null` si la zona
 * no existe, mismo criterio que `localTimeIn`.
 *
 * La usan los jobs de hábitos para saber qué día es "hoy"/"ayer" *para el
 * dueño del hábito*, no para el reloj del server que corre el cron.
 */
export function localDayIn(timeZone: string, at: Date): string | null {
  try {
    // `en-CA` es el locale "trampa" habitual para `yyyy-mm-dd`: es el único
    // formato corto de `Intl` que ya sale en ese orden con guiones.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return null;
  }
}

/**
 * `true` si `at` cae dentro de la franja de silencio del usuario.
 *
 * Sin `timeZone` devuelve `false`: la zona la manda el dispositivo al guardar
 * las preferencias o al suscribirse al push, y hasta que llegue no hay forma de
 * saber qué hora es *para el usuario*. Silenciar usando la hora del server
 * sería silenciar en el huso equivocado.
 */
export function isWithinQuietHours(
  quiet: QuietHours,
  timeZone: string | null,
  at: Date = new Date()
): boolean {
  if (!quiet.enabled || !timeZone) return false;
  if (!isValidTimeOfDay(quiet.from) || !isValidTimeOfDay(quiet.to)) return false;

  const nowLocal = localTimeIn(timeZone, at);
  if (!nowLocal) return false;

  // from === to sería una franja de 24 horas o de cero; se toma como apagada
  // para que un rango mal cargado no deje al usuario sin push para siempre.
  if (quiet.from === quiet.to) return false;

  return quiet.from < quiet.to
    ? nowLocal >= quiet.from && nowLocal < quiet.to
    : // Cruza la medianoche (ej. 22:00 → 08:00): es silencio si ya pasó `from`
      // o si todavía no llegó `to`.
      nowLocal >= quiet.from || nowLocal < quiet.to;
}
