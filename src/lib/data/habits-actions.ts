"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { COLLECTIONS, FieldValue, collection, now } from "@/lib/firebase/collections";

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
async function getOwnedHabitRef(id: string, ownerId: string) {
  const ref = collection(COLLECTIONS.habits).doc(id);
  const snapshot = await ref.get();
  const habit = snapshot.data();
  if (!habit || habit.ownerId !== ownerId) {
    throw new Error("Ese hábito ya no existe.");
  }
  return ref;
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

  const ref = await getOwnedHabitRef(habitId, session.sub);
  await ref.update({
    doneDates: done ? FieldValue.arrayUnion(day) : FieldValue.arrayRemove(day),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

export interface UpdateHabitInput extends HabitFieldsInput {
  id: string;
}

/** Edita nombre, emoji y meta. No toca `doneDates`: el historial no se reescribe al renombrar. */
export async function updateHabitAction(input: UpdateHabitInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidHabitFields(input);

  const ref = await getOwnedHabitRef(input.id, session.sub);
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
  const ref = await getOwnedHabitRef(habitId, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.inicio);
}
