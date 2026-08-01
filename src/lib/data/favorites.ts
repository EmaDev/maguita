import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, collection, now } from "@/lib/firebase/collections";
import { getMiniAppsByIds, type MiniApp } from "./mini-apps";

/**
 * Favoritos por usuario, en Firestore.
 *
 * Un documento por cuenta en `favorites`, con el `uid` como id y la lista de
 * mini-apps adentro. Los favoritos se leen siempre enteros y son pocos, así que
 * un array en un documento sale en una sola lectura; una subcolección serían N.
 */

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const snapshot = await collection(COLLECTIONS.favorites).doc(userId).get();
  return snapshot.data()?.miniAppIds ?? [];
}

export async function getFavorites(userId: string): Promise<MiniApp[]> {
  return getMiniAppsByIds(await getFavoriteIds(userId));
}

/**
 * Marca o desmarca un favorito y devuelve la lista resultante.
 *
 * Va en una transacción porque es un read-modify-write: sin ella, dos toques
 * casi simultáneos (la app abierta en el teléfono y en la compu) leen la misma
 * lista y el último en escribir pisa el cambio del otro.
 */
export async function toggleFavorite(
  userId: string,
  miniAppId: string
): Promise<string[]> {
  const ref = collection(COLLECTIONS.favorites).doc(userId);

  return adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.miniAppIds ?? [];

    const next = current.includes(miniAppId)
      ? current.filter((id) => id !== miniAppId)
      : [...current, miniAppId];

    // `merge` para que el documento se cree solo la primera vez.
    transaction.set(ref, { miniAppIds: next, updatedAt: now() }, { merge: true });
    return next;
  });
}
