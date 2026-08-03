"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import {
  COLLECTIONS,
  FieldValue,
  collection,
  now,
  type HabitDoc,
} from "@/lib/firebase/collections";
import { streakOf } from "@/lib/home-model";
import { notifyQuietly } from "@/lib/notifications/notify";

/** Tope del nombre. El mismo número lo usa el `maxLength` del composer. */
const MAX_NAME_LENGTH = 60;

/**
 * Tope de hábitos por cuenta. La tab los muestra todos juntos en una sola
 * lista sin paginar, y `doneDates` de cada uno viaja entero en cada carga de
 * Inicio: sin límite, una cuenta con cientos de hábitos haría lenta una
 * pantalla que no es sólo de hábitos.
 */
const MAX_HABITS = 50;

export interface HabitFieldsInput {
  name: string;
  emoji: string;
  goalPerWeek: number;
}

/** Valida los campos comunes al alta y a la edición. */
function assertValidHabitFields(input: HabitFieldsInput): void {
  const name = input.name.trim();
  if (!name) throw new Error("Poné un nombre para el hábito.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }
  if (!input.emoji.trim()) throw new Error("Elegí un emoji para el hábito.");
  if (!Number.isInteger(input.goalPerWeek) || input.goalPerWeek < 1 || input.goalPerWeek > 7) {
    throw new Error("La meta tiene que ser de 1 a 7 días por semana.");
  }
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
  if (existing.data().count >= MAX_HABITS) {
    throw new Error(`No podés tener más de ${MAX_HABITS} hábitos.`);
  }

  await habits.add({
    ownerId: session.sub,
    name: input.name.trim(),
    emoji: input.emoji,
    goalPerWeek: input.goalPerWeek,
    doneDates: [],
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
 */
export async function toggleHabitDayAction(
  habitId: string,
  day: string,
  done: boolean
): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidDay(day);

  const { ref, habit } = await getOwnedHabit(habitId, session.sub);
  await ref.update({
    doneDates: done ? FieldValue.arrayUnion(day) : FieldValue.arrayRemove(day),
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

export interface UpdateHabitInput extends HabitFieldsInput {
  id: string;
}

/** Edita nombre, emoji y meta. No toca `doneDates`: el historial no se reescribe al renombrar. */
export async function updateHabitAction(input: UpdateHabitInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidHabitFields(input);

  const { ref } = await getOwnedHabit(input.id, session.sub);
  await ref.update({
    name: input.name.trim(),
    emoji: input.emoji,
    goalPerWeek: input.goalPerWeek,
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/** Borra un hábito y, con él, todo su historial de días cumplidos. */
export async function deleteHabitAction(habitId: string): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  const { ref } = await getOwnedHabit(habitId, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.inicio);
}
