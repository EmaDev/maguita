import type { NotificationTone } from "lib-kit-components";

/**
 * Registro de tipos de notificación de la app.
 *
 * Es el **único punto de extensión** del sistema: una mini-app o un módulo
 * nuevo que quiera avisar algo agrega su topic acá y después llama a `notify()`
 * (`src/lib/notifications/notify.ts`) con ese id. Con eso ya tiene: entrada en
 * el panel de la campana, push al celular, y su propio interruptor en
 * `/ajustes/notificaciones` — sin tocar ninguna de esas tres partes.
 *
 * Este archivo **no** es `server-only` a propósito: lo lee el emisor (server) y
 * también la pantalla de preferencias (cliente), y que los dos deriven el label
 * y los defaults de la misma tabla es lo que evita que un topic exista en el
 * server pero no se pueda apagar desde la UI.
 *
 * Los ids son `grupo.evento` en kebab-case. El prefijo tiene que coincidir con
 * el `group`: es lo que agrupa la pantalla de preferencias.
 *
 * **Qué se puede apagar y qué no.** La preferencia por topic gobierna sólo el
 * **push**; la entrada del panel se escribe siempre. El panel es el registro de
 * lo que pasó — si se pudiera silenciar, un evento quedaría sin rastro en
 * ningún lado, y el usuario ya puede descartar o limpiar lo que no le importa.
 * Además, con una sola dimensión el `dedupeKey` de `notify()` tiene un lugar
 * único donde vivir (el documento de la bandeja), sin necesidad de un registro
 * paralelo de "esto ya lo mandé".
 */

/* ------------------------------------------------------------------ *
 * Grupos
 * ------------------------------------------------------------------ */

export interface NotificationGroup {
  id: string;
  label: string;
  description: string;
}

/**
 * Secciones de la pantalla de preferencias, en orden de aparición. Un grupo
 * por módulo que emite: sin esto, quince topics sueltos serían una lista plana
 * imposible de recorrer.
 */
export const NOTIFICATION_GROUPS = [
  {
    id: "system",
    label: "Cuenta y seguridad",
    description: "Avisos sobre tu cuenta y el estado de la app.",
  },
  {
    id: "notes",
    label: "Notas",
    description: "Recordatorios de las notas con alerta.",
  },
  {
    id: "expenses",
    label: "Gastos",
    description: "Avisos del período de gastos en curso.",
  },
  {
    id: "habits",
    label: "Hábitos",
    description: "Rachas y constancia de tus hábitos.",
  },
] as const satisfies readonly NotificationGroup[];

export type NotificationGroupId = (typeof NOTIFICATION_GROUPS)[number]["id"];

/* ------------------------------------------------------------------ *
 * Topics
 * ------------------------------------------------------------------ */

export interface NotificationTopic {
  group: NotificationGroupId;
  /** Título de la fila en `/ajustes/notificaciones`. */
  label: string;
  /** Bajada de esa fila: qué dispara esta notificación, en criollo. */
  description: string;
  /** Color e ícono con que el panel pinta la entrada. */
  tone: NotificationTone;
  /** Si el push sale activado cuando el usuario nunca tocó sus preferencias. */
  pushByDefault: boolean;
  /**
   * El push no se puede apagar: la fila aparece deshabilitada en las
   * preferencias y `notify()` ignora cualquier override guardado. Reservado
   * para avisos de cuenta y seguridad, que son justo los que no conviene poder
   * silenciar. El interruptor maestro de push sí los alcanza — ese apaga el
   * canal entero, no un topic.
   */
  required?: boolean;
}

/**
 * Para agregar un topic: sumá la entrada acá (con su `group`, su `tone` y su
 * default de push) y llamá a `notify({ topic: "<id>", ... })` desde donde
 * ocurra el evento. No hay nada más que registrar.
 */
export const NOTIFICATION_TOPICS = {
  "system.account": {
    group: "system",
    label: "Cuenta y seguridad",
    description: "Cambios de contraseña, inicios de sesión y avisos importantes.",
    tone: "info",
    pushByDefault: true,
    required: true,
  },
  "notes.alert": {
    group: "notes",
    label: "Recordatorios de notas",
    description: "Cuando llega la fecha y la hora de una nota con alerta.",
    tone: "warning",
    pushByDefault: true,
  },
  "expenses.limit-reached": {
    group: "expenses",
    label: "Tope del período",
    description: "Cuando tus gastos llegan al 80% del tope, y cuando lo superás.",
    tone: "danger",
    pushByDefault: true,
  },
  "habits.streak": {
    group: "habits",
    label: "Rachas",
    description: "Cuando una racha llega a 7, 30, 100… días seguidos.",
    tone: "success",
    pushByDefault: false,
  },
} as const satisfies Record<string, NotificationTopic>;

export type NotificationTopicId = keyof typeof NOTIFICATION_TOPICS;

export const NOTIFICATION_TOPIC_IDS = Object.keys(
  NOTIFICATION_TOPICS
) as NotificationTopicId[];

/** Definición de un topic. Tipada, así que un id inválido no compila. */
export function topicOf(id: NotificationTopicId): NotificationTopic {
  return NOTIFICATION_TOPICS[id];
}

/**
 * `true` si el id viene de un lugar donde no se puede confiar en el tipo — un
 * documento viejo de Firestore, o una preferencia guardada antes de que el
 * topic se renombrara.
 */
export function isNotificationTopicId(id: string): id is NotificationTopicId {
  return Object.hasOwn(NOTIFICATION_TOPICS, id);
}

/** Topics de un grupo, en el orden en que están declarados arriba. */
export function topicsOfGroup(group: NotificationGroupId): NotificationTopicId[] {
  return NOTIFICATION_TOPIC_IDS.filter((id) => NOTIFICATION_TOPICS[id].group === group);
}
