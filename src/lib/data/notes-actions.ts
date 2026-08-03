"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, Timestamp, collection, now } from "@/lib/firebase/collections";
import type { NotePriority } from "./home";

export interface NoteFieldsInput {
  text: string;
  date: string;
  priority: NotePriority;
  hasAlert: boolean;
  /** Requeridos si `hasAlert` es `true`. */
  alertDate?: string | null;
  alertTime?: string | null;
  /**
   * Instante absoluto de la alerta en ms (`alertInstant`, calculado en el
   * cliente). Requerido si `hasAlert` es `true`: sin él el recordatorio se
   * guarda pero el cron no lo puede encontrar.
   */
  alertAtMs?: number | null;
}

/**
 * Ventana en la que se acepta un `alertAtMs`. El valor lo calcula el cliente
 * con su propio reloj, así que puede venir de un dispositivo con la hora mal
 * puesta; el rango descarta lo absurdo (un recordatorio para 1970, o para
 * dentro de un siglo) sin pretender validar el huso, que es justamente lo que
 * el server no puede saber.
 */
const MAX_ALERT_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_ALERT_HORIZON_MS = 10 * 365 * 24 * 60 * 60 * 1000;

/** Valida los campos comunes al alta y a la edición de una nota. */
function assertValidNoteFields(input: NoteFieldsInput): void {
  if (!input.text.trim()) throw new Error("Escribí algo antes de guardar la nota.");
  if (!input.date) throw new Error("Elegí una fecha para la nota.");
  if (!input.hasAlert) return;

  if (!input.alertDate || !input.alertTime) {
    throw new Error("Completá la fecha y la hora de la alerta.");
  }
  const alertAtMs = input.alertAtMs;
  if (typeof alertAtMs !== "number" || !Number.isFinite(alertAtMs)) {
    throw new Error("No se pudo interpretar la fecha y hora de la alerta.");
  }
  const now = Date.now();
  if (alertAtMs < now - MAX_ALERT_AGE_MS || alertAtMs > now + MAX_ALERT_HORIZON_MS) {
    throw new Error("La fecha de la alerta está fuera de rango.");
  }
}

/** Los tres campos de la alerta, resueltos juntos: o van los tres, o van los tres en `null`. */
function alertFieldsOf(input: NoteFieldsInput) {
  return input.hasAlert
    ? {
        alertDate: input.alertDate!,
        alertTime: input.alertTime!,
        alertAt: Timestamp.fromMillis(input.alertAtMs!),
      }
    : { alertDate: null, alertTime: null, alertAt: null };
}

/**
 * Trae la nota y valida dueño en un solo lugar: la usan `updateNoteAction` y
 * `deleteNoteAction`. El Admin SDK saltea `firestore.rules`, así que este
 * chequeo es la única barrera real contra que una sesión válida edite o
 * borre la nota de otra cuenta pasando su `id`.
 */
async function getOwnedNoteRef(id: string, ownerId: string) {
  const ref = collection(COLLECTIONS.notes).doc(id);
  const snapshot = await ref.get();
  const note = snapshot.data();
  if (!note || note.ownerId !== ownerId) {
    throw new Error("Esa nota ya no existe.");
  }
  return ref;
}

export type AddNoteInput = NoteFieldsInput;

/**
 * Alta de una nota. Re-verifica la sesión porque una Server Action es un
 * endpoint público, igual que el resto de `lib/data/*-actions`.
 */
export async function addNoteAction(input: AddNoteInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidNoteFields(input);

  await collection(COLLECTIONS.notes).add({
    ownerId: session.sub,
    text: input.text.trim(),
    date: input.date,
    priority: input.priority,
    hasAlert: input.hasAlert,
    ...alertFieldsOf(input),
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

export interface UpdateNoteInput extends NoteFieldsInput {
  id: string;
}

/** Edita una nota existente. No toca `createdAt`. */
export async function updateNoteAction(input: UpdateNoteInput): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  assertValidNoteFields(input);

  const ref = await getOwnedNoteRef(input.id, session.sub);
  await ref.update({
    text: input.text.trim(),
    date: input.date,
    priority: input.priority,
    hasAlert: input.hasAlert,
    ...alertFieldsOf(input),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.inicio);
}

/** Borra una nota. */
export async function deleteNoteAction(id: string): Promise<void> {
  const session = await requireSession(ROUTES.inicio);
  const ref = await getOwnedNoteRef(id, session.sub);
  await ref.delete();
  revalidatePath(ROUTES.inicio);
}

/**
 * Tope del borrado masivo. Un `WriteBatch` de Firestore admite 500
 * operaciones; con el borrado por selección de la tab Notas es imposible
 * llegar ahí a mano, pero el id lo manda el cliente, así que el límite se
 * chequea igual en vez de confiar en que la UI no lo pase.
 */
const MAX_BULK_DELETE = 500;

/**
 * Borra varias notas de una. Valida dueño documento por documento y **saltea**
 * en silencio lo que no sea del usuario en vez de cortar todo: el id lo manda
 * el cliente, y fallar distinto según "no existe" o "no es tuyo" delataría
 * qué ids existen. Si al final no quedó ninguna propia, ahí sí avisa — si no,
 * el borrado se vería como exitoso sin haber borrado nada.
 */
export async function deleteNotesAction(ids: string[]): Promise<void> {
  const session = await requireSession(ROUTES.inicio);

  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return;
  if (unique.length > MAX_BULK_DELETE) {
    throw new Error(`No se pueden borrar más de ${MAX_BULK_DELETE} notas a la vez.`);
  }

  const notes = collection(COLLECTIONS.notes);
  const snapshots = await Promise.all(unique.map((id) => notes.doc(id).get()));

  const batch = adminDb().batch();
  let owned = 0;
  for (const snapshot of snapshots) {
    const note = snapshot.data();
    if (!note || note.ownerId !== session.sub) continue;
    batch.delete(snapshot.ref);
    owned += 1;
  }

  if (owned === 0) throw new Error("Esas notas ya no existen.");

  await batch.commit();
  revalidatePath(ROUTES.inicio);
}
