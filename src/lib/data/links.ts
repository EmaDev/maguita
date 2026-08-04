import "server-only";
import { COLLECTIONS, collection, withId } from "@/lib/firebase/collections";

/**
 * Links guardados de la mini-app privada de links: alta por URL, preview
 * (título/descripción/imagen) resuelto una sola vez al guardar.
 */
export interface SavedLink {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
  /** Descripción propia del usuario (distinta de `description`, la de los metatags). */
  note: string | null;
  /** Categoría libre del usuario. */
  category: string | null;
  /** `createdAt` en milisegundos — se manda ya resuelto porque un `Timestamp` de Firestore no serializa a un Client Component. */
  createdAt: number;
}

/**
 * Links del usuario, más reciente primero. Filtra sólo por `ownerId`
 * (equality) y ordena en memoria por `createdAt` — mismo criterio que
 * `getNotes`/`getExpenseMovements`, evita pedirle a Firestore un índice
 * compuesto.
 */
export async function getLinks(userId: string): Promise<SavedLink[]> {
  const snapshot = await collection(COLLECTIONS.links).where("ownerId", "==", userId).get();

  return snapshot.docs
    .map((doc) => withId(doc))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .map((data) => ({
      id: data.id,
      url: data.url,
      title: data.title,
      description: data.description,
      image: data.image,
      siteName: data.siteName,
      domain: data.domain,
      note: data.note ?? null,
      category: data.category ?? null,
      createdAt: data.createdAt?.toMillis() ?? 0,
    }));
}
