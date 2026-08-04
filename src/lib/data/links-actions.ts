"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { COLLECTIONS, collection, now } from "@/lib/firebase/collections";
import { fetchLinkMetadata } from "./link-metadata";

/** Sin protocolo, asume https — así "github.com" alcanza sin que el usuario tenga que tipear el esquema. */
function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol);
}

/** `""`/sólo espacios cuenta como "no puso nada" — se guarda `null`, no un string vacío. */
const orNull = (value: string | undefined) => value?.trim() || null;

/**
 * Alta de un link. Trae los metatags Open Graph del lado del server
 * (`fetchLinkMetadata`, evita CORS del browser contra sitios de terceros) y
 * los guarda ya resueltos — si el fetch falla o el sitio no publica
 * metatags, el link igual se guarda con la URL y el dominio como único dato,
 * sin bloquear el alta. `note`/`category` son del usuario, no de los
 * metatags — opcionales, se pueden completar acá o después con
 * `updateLinkAction`.
 */
export async function addLinkAction(
  rawUrl: string,
  extra?: { note?: string; category?: string }
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppLinks);

  let parsed: URL;
  try {
    parsed = normalizeUrl(rawUrl);
  } catch {
    throw new Error("Ese enlace no es válido.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Ese enlace no es válido.");
  }

  const metadata = await fetchLinkMetadata(parsed.toString());

  await collection(COLLECTIONS.links).add({
    ownerId: session.sub,
    url: parsed.toString(),
    title: metadata.title,
    description: metadata.description,
    image: metadata.image,
    siteName: metadata.siteName,
    domain: parsed.hostname.replace(/^www\./, ""),
    note: orNull(extra?.note),
    category: orNull(extra?.category),
    createdAt: now(),
    updatedAt: now(),
  });

  revalidatePath(ROUTES.miniAppLinks);
}

/**
 * Edita la descripción y/o categoría propias de un link ya guardado (no
 * toca los metatags). Re-verifica dueño antes de escribir, mismo criterio
 * que `deleteLinkAction`.
 */
export async function updateLinkAction(
  linkId: string,
  updates: { note?: string; category?: string }
): Promise<void> {
  const session = await requireSession(ROUTES.miniAppLinks);

  const ref = collection(COLLECTIONS.links).doc(linkId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!data || data.ownerId !== session.sub) {
    throw new Error("Ese link no existe.");
  }

  await ref.update({
    note: orNull(updates.note),
    category: orNull(updates.category),
    updatedAt: now(),
  });
  revalidatePath(ROUTES.miniAppLinks);
}

/**
 * Borra un link. Re-verifica dueño antes de borrar (el Admin SDK saltea
 * `firestore.rules`), mismo criterio que el resto de las Server Actions que
 * tocan documentos con `ownerId`.
 */
export async function deleteLinkAction(linkId: string): Promise<void> {
  const session = await requireSession(ROUTES.miniAppLinks);

  const ref = collection(COLLECTIONS.links).doc(linkId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!data || data.ownerId !== session.sub) {
    throw new Error("Ese link no existe.");
  }

  await ref.delete();
  revalidatePath(ROUTES.miniAppLinks);
}
