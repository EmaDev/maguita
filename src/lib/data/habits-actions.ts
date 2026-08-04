"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  FieldValue,
  collection,
  now,
  type HabitActionDoc,
  type HabitDoc,
} from "@/lib/firebase/collections";
import { HABIT_COMPLETION_POINTS, allActionsDoneOn, isScheduledOn, streakOf } from "@/lib/home-model";
import { notifyQuietly } from "@/lib/notifications/notify";
import { isValidTimeOfDay } from "@/lib/notifications/quiet-hours";

/** Tope del nombre. El mismo número lo usa el `maxLength` del composer. */
const MAX_NAME_LENGTH = 60;

/** Tope del subtítulo. Mismo criterio que `MAX_NAME_LENGTH`. */
const MAX_SUBTITLE_LENGTH = 80;

/**
 * Tope de acciones por hábito. Mismo espíritu que `MAX_HABITS`: `actions`
 * viaja entero en cada carga de Inicio, así que una rutina de docenas de
 * pasos haría lenta una pantalla que no es sólo de hábitos.
 */
const MAX_ACTIONS_PER_HABIT = 20;

/**
 * Tope de hábitos por cuenta. La tab los muestra todos juntos en una sola
 * lista sin paginar, y `doneDates` de cada uno viaja entero en cada carga de
 * Inicio: sin límite, una cuenta con cientos de hábitos haría lenta una
 * pantalla que no es sólo de hábitos.
 */
const MAX_HABITS = 50;

export interface HabitFieldsInput {
  name: string;
  subtitle: string | null;
  emoji: string;
  scheduledWeekdays: number[];
  alertEnabled: boolean;
  alertTime: string | null;
  /** `[]` = hábito simple. No vacío = hábito de grupo, se muestra como timeline. */
  actions: HabitActionDoc[];
}

/** Valida los campos comunes al alta y a la edición. */
function assertValidHabitFields(input: HabitFieldsInput): void {
  const name = input.name.trim();
  if (!name) throw new Error("Poné un nombre para el hábito.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }
  if ((input.subtitle?.trim().length ?? 0) > MAX_SUBTITLE_LENGTH) {
    throw new Error(`El subtítulo no puede tener más de ${MAX_SUBTITLE_LENGTH} caracteres.`);
  }
  if (!input.emoji.trim()) throw new Error("Elegí un emoji para el hábito.");

  const days = new Set(input.scheduledWeekdays);
  if (
    days.size === 0 ||
    input.scheduledWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new Error("Elegí al menos un día de la semana.");
  }
  if (input.alertEnabled && !isValidTimeOfDay(input.alertTime ?? "")) {
    throw new Error("Elegí una hora válida para el aviso.");
  }

  if (input.actions.length > MAX_ACTIONS_PER_HABIT) {
    throw new Error(`No podés tener más de ${MAX_ACTIONS_PER_HABIT} pasos.`);
  }
  const actionIds = new Set<string>();
  for (const action of input.actions) {
    const actionName = action.name.trim();
    if (!actionName) throw new Error("Los pasos no pueden tener el nombre vacío.");
    if (actionName.length > MAX_NAME_LENGTH) {
      throw new Error(`Un paso no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
    }
    if (!action.id.trim() || actionIds.has(action.id)) {
      throw new Error("Hubo un problema con los pasos del hábito. Volvé a intentar.");
    }
    actionIds.add(action.id);
  }
}

/** Sin duplicados y ordenados — el composer manda `Set`-like selection, pero no está garantizado. */
function normalizeWeekdays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/**
 * Valida una day key. El día lo manda el cliente (es *su* día local, el
 * server no conoce su huso), así que no se puede verificar contra el reloj del
 * server — pero sí que sea una fecha real y no un string cualquiera, que es lo
 * que evita ensuciar `doneDates` con basura que después rompa la grilla de
 * constancia.
 */
function assertValidDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Ese día no es válido.");
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year!, month! - 1, date!);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month! - 1 ||
    parsed.getDate() !== date
  ) {
    throw new Error("Ese día no es válido.");
  }
}

/**
 * Trae el hábito y valida dueño en un solo lugar, igual que `getOwnedNoteRef`.
 * El Admin SDK saltea `firestore.rules`, así que este chequeo es la única
 * barrera real contra que una sesión válida toque el hábito de otra cuenta
 * pasando su `id`.
 */
async function getOwnedHabit(id: string, ownerId: string) {
  const ref = collection(COLLECTIONS.habits).doc(id);
  const snapshot = await ref.get();
  const habit = snapshot.data();
  if (!habit || habit.ownerId !== ownerId) {
    throw new Error("Ese hábito ya no existe.");
  }
  // Devuelve también el documento (no sólo la referencia) porque el aviso de
  // racha necesita `doneDates`, `name` y `emoji`, y ya están leídos acá.
  return { ref, habit };
}

export type AddHabitInput = HabitFieldsInput;

/**
 * Alta de un hábito. Re-verifica la sesión porque una Server Action es un
 * endpoint público, igual que el resto de `lib/data/*-actions`.
 */
export async function addHabitAction(input: AddHabitInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidHabitFields(input);

  const habits = collection(COLLECTIONS.habits);
  const existing = await habits.where("ownerId", "==", session.sub).count().get();
  const count = existing.data().count;
  if (count >= MAX_HABITS) {
    throw new Error(`No podés tener más de ${MAX_HABITS} hábitos.`);
  }

  await habits.add({
    ownerId: session.sub,
    name: input.name.trim(),
    subtitle: input.subtitle?.trim() || null,
    emoji: input.emoji,
    scheduledWeekdays: normalizeWeekdays(input.scheduledWeekdays),
    alertEnabled: input.alertEnabled,
    alertTime: input.alertEnabled ? input.alertTime : null,
    score: 0,
    // Se agrega al final de la lista actual del usuario.
    order: count,
    lastPenalizedDay: null,
    doneDates: [],
    actions: input.actions.map((action) => ({ id: action.id, name: action.name.trim() })),
    actionDoneDates: {},
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/**
 * Marca o desmarca un día de un hábito.
 *
 * Usa `arrayUnion`/`arrayRemove` en vez de leer el array, modificarlo y
 * escribirlo entero: son operaciones atómicas del lado de Firestore, así que
 * dos toques rápidos (o la misma cuenta en dos dispositivos) no se pisan, y
 * `arrayUnion` ya es idempotente — marcar dos veces el mismo día no lo
 * duplica, que es justo lo que necesita una UI optimista donde el toggle
 * puede reintentarse.
 *
 * El puntaje sólo se mueve si `day` es un día programado del hábito: uno
 * marcado fuera de horario (historial viejo, o un "extra" del usuario) sigue
 * contando para la racha pero no puntúa.
 */
export async function toggleHabitDayAction(
  habitId: string,
  day: string,
  done: boolean
): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidDay(day);

  const { ref, habit } = await getOwnedHabit(habitId, session.sub);
  const scored = isScheduledOn(habit.scheduledWeekdays ?? [], day);

  await ref.update({
    doneDates: done ? FieldValue.arrayUnion(day) : FieldValue.arrayRemove(day),
    ...(scored && {
      score: FieldValue.increment(done ? HABIT_COMPLETION_POINTS : -HABIT_COMPLETION_POINTS),
    }),
    updatedAt: now(),
  });

  if (done) {
    await notifyStreakMilestone(session.sub, habitId, habit, day);
  }

  revalidatePath(ROUTES.inicio);
}

/**
 * Rachas que se festejan. Más allá de 365 no hay hito: a esa altura el aviso
 * dejó de ser noticia y pasaría a ser ruido anual.
 */
const STREAK_MILESTONES = [7, 30, 100, 365] as const;

/**
 * Avisa cuando marcar el día lleva la racha justo a un hito.
 *
 * La racha se calcula acá con `streakOf` sobre el array que ya trajo
 * `getOwnedHabit` más el día recién marcado, en vez de releer el documento
 * después del `update()`: es la misma cuenta que hace la UI y ahorra la
 * segunda lectura. Sólo avisa en el valor **exacto** del hito, no en "mayor o
 * igual" — con `>=` cada día siguiente a los 7 volvería a entrar (la
 * `dedupeKey` lo frenaría igual, pero por el camino largo).
 */
async function notifyStreakMilestone(
  userId: string,
  habitId: string,
  habit: HabitDoc,
  day: string
): Promise<void> {
  const doneDates = [...(habit.doneDates ?? []), day];
  const streak = streakOf(doneDates, day);
  if (!STREAK_MILESTONES.includes(streak as (typeof STREAK_MILESTONES)[number])) return;

  await notifyQuietly({
    userId,
    topic: "habits.streak",
    title: `${habit.emoji} ${streak} días seguidos`,
    description: `Llevás ${streak} días sin fallar con «${habit.name}». No la cortes ahora.`,
    href: ROUTES.inicio,
    dedupeKey: `${habitId}:${streak}`,
  });
}

/**
 * Marca o desmarca un paso puntual de un hábito de grupo.
 *
 * Análoga a `toggleHabitDayAction`, pero acá el `arrayUnion`/`arrayRemove`
 * apunta a una ruta de campo dentro del mapa (`actionDoneDates.${actionId}`)
 * en vez de a `doneDates` directo — ver la nota de diseño en `HabitDoc`
 * sobre por qué es un mapa y no un array anidado.
 *
 * `doneDates`/`score` del hábito son **derivados** acá: se recalculan en
 * memoria (sobre lo que ya trajo `getOwnedHabit` más este cambio, mismo
 * patrón que `notifyStreakMilestone`) comparando si el día pasa a estar — o
 * deja de estar — completo entre *todas* las acciones, y sólo entonces se
 * escriben junto con el toggle de la acción, en un solo `update()`.
 */
export async function toggleHabitActionAction(
  habitId: string,
  actionId: string,
  day: string,
  done: boolean
): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidDay(day);

  const { ref, habit } = await getOwnedHabit(habitId, session.sub);
  const actions = habit.actions ?? [];
  if (!actions.some((action) => action.id === actionId)) {
    throw new Error("Ese paso ya no existe.");
  }

  const actionDoneDates = habit.actionDoneDates ?? {};
  const wasCompleteToday = (habit.doneDates ?? []).includes(day);
  const isCompleteToday = allActionsDoneOn(
    actions.map((action) => ({
      id: action.id,
      name: action.name,
      doneDates:
        action.id === actionId
          ? updateDayList(actionDoneDates[action.id] ?? [], day, done)
          : (actionDoneDates[action.id] ?? []),
    })),
    day
  );

  const scored = isScheduledOn(habit.scheduledWeekdays ?? [], day);

  await ref.update({
    [`actionDoneDates.${actionId}`]: done ? FieldValue.arrayUnion(day) : FieldValue.arrayRemove(day),
    ...(isCompleteToday !== wasCompleteToday && {
      doneDates: isCompleteToday ? FieldValue.arrayUnion(day) : FieldValue.arrayRemove(day),
      ...(scored && {
        score: FieldValue.increment(
          isCompleteToday ? HABIT_COMPLETION_POINTS : -HABIT_COMPLETION_POINTS
        ),
      }),
    }),
    updatedAt: now(),
  });

  if (isCompleteToday && !wasCompleteToday) {
    await notifyStreakMilestone(session.sub, habitId, habit, day);
  }

  revalidatePath(ROUTES.inicio);
}

/** `doneDates` de una sola acción con `day` agregado o quitado, sin duplicados. */
function updateDayList(doneDates: string[], day: string, done: boolean): string[] {
  return done ? Array.from(new Set([...doneDates, day])) : doneDates.filter((d) => d !== day);
}

export interface UpdateHabitInput extends HabitFieldsInput {
  id: string;
}

/**
 * Edita nombre, subtítulo, emoji, horario, alerta y pasos. No toca
 * `doneDates` (fuera de lo que implique el cambio de pasos) ni `score` ni
 * `order`: el historial no se reescribe al renombrar, y el puntaje/posición
 * se manejan por sus propias acciones.
 *
 * `actionDoneDates` se reconcilia contra los ids de `input.actions`: las
 * acciones que siguen existiendo conservan su historial, las que se
 * borraron del form pierden su entrada del mapa en vez de quedar como
 * basura acumulando en el documento para siempre.
 */
export async function updateHabitAction(input: UpdateHabitInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidHabitFields(input);

  const { ref, habit } = await getOwnedHabit(input.id, session.sub);

  const nextActionIds = new Set(input.actions.map((action) => action.id));
  const actionDoneDates = Object.fromEntries(
    Object.entries(habit.actionDoneDates ?? {}).filter(([id]) => nextActionIds.has(id))
  );

  await ref.update({
    name: input.name.trim(),
    subtitle: input.subtitle?.trim() || null,
    emoji: input.emoji,
    scheduledWeekdays: normalizeWeekdays(input.scheduledWeekdays),
    alertEnabled: input.alertEnabled,
    alertTime: input.alertEnabled ? input.alertTime : null,
    actions: input.actions.map((action) => ({ id: action.id, name: action.name.trim() })),
    actionDoneDates,
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/**
 * Tope del batch de reordenamiento. Muy por encima de `MAX_HABITS`, pero se
 * chequea igual en vez de confiar en que la UI no pase una lista más larga —
 * mismo criterio que `MAX_BULK_DELETE` en `notes-actions.ts`.
 */
const MAX_REORDER = 200;

/**
 * Reescribe el orden manual de la lista tras un drag & drop.
 *
 * Reescribe `order: index` para cada id recibido, en el orden en que llegan.
 * Valida dueño documento por documento y **saltea en silencio** los que no
 * sean del usuario, mismo criterio que `deleteNotesAction`: el id lo manda el
 * cliente, y fallar todo por uno ajeno dejaría el resto del drag sin guardar.
 */
export async function reorderHabitsAction(orderedIds: string[]): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  const ids = Array.from(new Set(orderedIds));
  if (ids.length === 0) return;
  if (ids.length > MAX_REORDER) {
    throw new Error(`No se pueden reordenar más de ${MAX_REORDER} hábitos a la vez.`);
  }

  const habits = collection(COLLECTIONS.habits);
  const snapshots = await Promise.all(ids.map((id) => habits.doc(id).get()));

  const batch = adminDb().batch();
  ids.forEach((id, index) => {
    const habit = snapshots[index]?.data();
    if (!habit || habit.ownerId !== session.sub) return;
    batch.update(habits.doc(id), { order: index, updatedAt: now() });
  });

  await batch.commit();
  revalidatePath(ROUTES.inicio);
}

/** Borra un hábito y, con él, todo su historial de días cumplidos. */
export async function deleteHabitAction(habitId: string): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  const { ref } = await getOwnedHabit(habitId, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.inicio);
}
