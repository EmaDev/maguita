import "server-only";
import { adminStorage } from "./admin";

const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

/** Ruta fija por usuario: una subida nueva sobreescribe la anterior, sin huérfanos. */
function avatarPath(uid: string): string {
  return `avatars/${uid}/avatar.jpg`;
}

/**
 * Sube la foto de perfil y devuelve la URL para guardar en `avatarUrl`.
 *
 * Usa el endpoint REST de Firebase (no `storage.googleapis.com/bucket/obj`)
 * porque ese respeta `storage.rules` en vez del IAM del bucket — así la
 * lectura pública de `avatars/{uid}/*` no depende de que el proyecto tenga
 * "Public access prevention" desactivado. El query `v` es cache-busting: cada
 * subida nueva es una URL distinta, así el browser no sirve la foto vieja.
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const path = avatarPath(uid);
  const buffer = Buffer.from(await file.arrayBuffer());

  await adminStorage()
    .bucket(BUCKET_NAME)
    .file(path)
    .save(buffer, {
      metadata: {
        contentType: file.type || "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(path)}?alt=media&v=${Date.now()}`;
}
