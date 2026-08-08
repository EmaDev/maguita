"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireFreshSession } from "@/lib/auth/dal";
import { adminDb } from "@/lib/firebase/admin";
import { collection, type CollectionName } from "@/lib/firebase/collections";
import { findResettableModule } from "./module-reset";

/** Tope de un `WriteBatch` de Firestore. */
const DELETE_BATCH_SIZE = 500;

/**
 * Borra todos los documentos de `name` que sean de `uid`, en tandas de
 * `DELETE_BATCH_SIZE`: un módulo puede superar el tope de un solo batch (ej.
 * años de `workoutSessions`), así que repite hasta que la colección quede
 * vacía para ese usuario en vez de asumir que entra en una sola tanda.
 */
async function deleteOwnedDocs(name: CollectionName, uid: string): Promise<void> {
  const ref = collection(name);
  for (;;) {
    const snapshot = await ref.where("ownerId", "==", uid).limit(DELETE_BATCH_SIZE).get();
    if (snapshot.empty) return;

    const batch = adminDb().batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();

    if (snapshot.size < DELETE_BATCH_SIZE) return;
  }
}

/**
 * Borra todos los datos de un módulo/mini-app del usuario actual —
 * "restablecer" el módulo a como estaba antes de usarlo. Irreversible, así
 * que pide sesión fresca (mismo criterio que borrar la cuenta), no la cookie
 * sola.
 */
export async function resetModuleDataAction(moduleId: string): Promise<void> {
  const session = await requireFreshSession(ROUTES.ajustes);

  const resettableModule = findResettableModule(moduleId);
  if (!resettableModule) throw new Error("Ese módulo no existe.");

  for (const col of resettableModule.collections) {
    if (col.keyedBy === "docId") {
      await collection(col.name).doc(session.sub).delete();
    } else {
      await deleteOwnedDocs(col.name, session.sub);
    }
  }

  revalidatePath(ROUTES.ajustes);
  revalidatePath(ROUTES.inicio);
}
