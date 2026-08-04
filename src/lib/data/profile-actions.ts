"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { collect, validateName, type AuthFormState } from "@/lib/auth/validation";
import {
  COLLECTIONS,
  collection,
  DEFAULT_PREFERENCES,
  FieldValue,
  now,
  type UserDoc,
  type UserPreferences,
  type Writable,
} from "@/lib/firebase/collections";
import { uploadAvatar } from "@/lib/firebase/storage";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/**
 * Edita nombre, alias y/o foto de perfil desde el form de "Editar perfil"
 * (`EditProfileForm`, patrón `useActionState`). Vuelve a verificar la sesión:
 * una Server Action es un endpoint público, no puede confiar en que la
 * pantalla que la llamó ya estaba protegida (mismo criterio que
 * `toggleFavoriteAction`).
 */
export async function updateProfileAction(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const session = await requireSession(ROUTES.editarPerfil);

  const name = field(formData, "name");
  const alias = field(formData, "alias").trim() || null;
  const avatar = formData.get("avatar");
  const values = { name, alias: alias ?? "" };

  const errors = collect({ name: validateName(name) ?? "" });
  if (errors) return { errors, values };

  const updates: Writable<UserDoc> = {
    updatedAt: now(),
    name: name.trim(),
    alias,
  };

  // `formData.get` de un `<input type="file">` vacío devuelve un File con
  // `size` 0, nunca `null` — por eso se chequea el tamaño y no la presencia.
  if (avatar instanceof File && avatar.size > 0) {
    if (!avatar.type.startsWith("image/")) {
      return { errors: { avatar: "El archivo tiene que ser una imagen." }, values };
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return { errors: { avatar: "La imagen es demasiado pesada." }, values };
    }
    updates.avatarUrl = await uploadAvatar(session.sub, avatar);
  }

  await collection(COLLECTIONS.users).doc(session.sub).set(updates, { merge: true });
  revalidatePath(ROUTES.editarPerfil);
  revalidatePath(ROUTES.ajustes);

  return { ok: true, notice: "Perfil actualizado.", values };
}

/**
 * Actualiza sólo las claves de `preferences` que vengan en `updates`, sin
 * pisar el resto — por eso lee el documento antes de escribirlo en vez de
 * mandar `updates` directo con `merge`, que dejaría un objeto `preferences`
 * a medio completar si todavía no existía.
 */
export async function updatePreferencesAction(
  updates: Partial<UserPreferences>
): Promise<void> {
  const session = await requireSession(ROUTES.ajustes);
  const ref = collection(COLLECTIONS.users).doc(session.sub);

  const snapshot = await ref.get();
  const current = snapshot.data()?.preferences ?? DEFAULT_PREFERENCES;

  await ref.set(
    { preferences: { ...current, ...updates }, updatedAt: now() },
    { merge: true }
  );
  revalidatePath(ROUTES.ajustes);
}

const hashPin = (pin: string) => createHash("sha256").update(pin).digest("hex");

/**
 * Define, cambia o quita el PIN compartido de PinLock. `null` lo desactiva y
 * limpia `lockedModules`: no puede quedar un módulo "bloqueado" sin PIN
 * contra el cual verificar.
 */
export async function setPinAction(pin: string | null): Promise<void> {
  if (pin !== null && !/^\d{4}$/.test(pin)) {
    throw new Error("El PIN tiene que ser de 4 dígitos.");
  }

  const session = await requireSession(ROUTES.ajustes);
  await collection(COLLECTIONS.users)
    .doc(session.sub)
    .update({
      "preferences.pinHash": pin ? hashPin(pin) : null,
      ...(pin === null && { "preferences.lockedModules": [] }),
      updatedAt: now(),
    });
  revalidatePath(ROUTES.ajustes);
  revalidatePath(ROUTES.inicio);
}

/**
 * Prende o apaga el candado de PinLock de un módulo puntual (un tab de
 * Inicio o una mini-app). `arrayUnion`/`arrayRemove` en vez de leer-y-pisar:
 * mismo criterio atómico que `toggleHabitDayAction`
 * (`src/lib/data/habits-actions.ts`).
 */
export async function setModuleLockAction(moduleId: string, locked: boolean): Promise<void> {
  const session = await requireSession();
  const ref = collection(COLLECTIONS.users).doc(session.sub);

  const snapshot = await ref.get();
  if (!snapshot.data()?.preferences?.pinHash) {
    throw new Error("Configurá un PIN en Ajustes antes de activar el bloqueo.");
  }

  await ref.update({
    "preferences.lockedModules": locked
      ? FieldValue.arrayUnion(moduleId)
      : FieldValue.arrayRemove(moduleId),
    updatedAt: now(),
  });
  revalidatePath(ROUTES.inicio);
  revalidatePath(ROUTES.miniAppSplitGastos);
  revalidatePath(ROUTES.miniAppLinks);
}

/**
 * Verifica un código contra el hash guardado. La usa `PinLock.onUnlock`
 * desde el cliente — nunca se manda el hash al browser.
 */
export async function verifyPinAction(code: string): Promise<boolean> {
  const session = await requireSession();
  const snapshot = await collection(COLLECTIONS.users).doc(session.sub).get();
  const pinHash = snapshot.data()?.preferences?.pinHash;
  return Boolean(pinHash) && pinHash === hashPin(code);
}
