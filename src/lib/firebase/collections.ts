import "server-only";
import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type PartialWithFieldValue,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { adminDb } from "./admin";

/**
 * Registro de colecciones de Firestore.
 *
 * Todas las colecciones se nombran acá y se leen con `collection(...)`, que
 * devuelve una referencia ya tipada. Es lo que evita que el nombre de una
 * colección quede escrito a mano en cinco archivos y que un `doc.data()` se use
 * como `any`.
 *
 * Para sumar una colección: agregá la clave en `COLLECTIONS`, definí su
 * interfaz de documento acá abajo y sumá la entrada en `CollectionTypes`.
 */
export const COLLECTIONS = {
  /** Perfil de cada cuenta. El id del documento es el `uid` de Firebase Auth. */
  users: "users",
  /** Favoritos por usuario. Id del documento = `uid`. */
  favorites: "favorites",
  /** Códigos de recuperación de contraseña, de un solo uso. */
  passwordResetCodes: "passwordResetCodes",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/* ------------------------------------------------------------------ *
 * Documentos
 * ------------------------------------------------------------------ */

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  haptics: boolean;
  reduceData: boolean;
}

/** Mismos defaults que ya usa el cliente hoy desde `localStorage` (ver `lib/theme.ts` y `SettingsPanel`). */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  haptics: true,
  reduceData: false,
};

export interface UserDoc {
  email: string;
  name: string;
  /** Apodo libre, sin unicidad. `null` hasta que el usuario lo defina. */
  alias: string | null;
  /** URL de la foto de perfil (ej. claim `picture` de Google). `null` si no hay. */
  avatarUrl: string | null;
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FavoritesDoc {
  /** Ids de mini-apps, en el orden en que se fueron marcando. */
  miniAppIds: string[];
  updatedAt: Timestamp;
}

export interface PasswordResetCodeDoc {
  uid: string;
  email: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

/** Mapea cada colección con la forma de sus documentos. */
export interface CollectionTypes {
  [COLLECTIONS.users]: UserDoc;
  [COLLECTIONS.favorites]: FavoritesDoc;
  [COLLECTIONS.passwordResetCodes]: PasswordResetCodeDoc;
}

/* ------------------------------------------------------------------ *
 * Acceso tipado
 * ------------------------------------------------------------------ */

/** Documento leído más su id, para cuando hace falta pasarlos juntos. */
export type WithId<T> = T & { id: string };

/**
 * Al escribir se aceptan `FieldValue` (`serverTimestamp()`, `arrayUnion()`, …)
 * en cualquier campo. Útil para las firmas de `update()` parciales.
 */
export type Writable<T> = PartialWithFieldValue<T>;

/**
 * El converter tipa el contenido del documento, no el id: en Firestore el id es
 * la clave, vive fuera del `data()` y ya está en `snapshot.id`. Meterlo adentro
 * del tipo obligaría a pasarlo en cada `set()`, donde es redundante.
 */
function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (model) => model as DocumentData,
    fromFirestore: (snapshot: QueryDocumentSnapshot) => snapshot.data() as T,
  };
}

/**
 * Referencia tipada a una colección.
 *
 * ```ts
 * const snap = await collection(COLLECTIONS.users).doc(uid).get();
 * snap.data()?.email // string | undefined, sin casts
 * ```
 */
export function collection<N extends CollectionName>(
  name: N
): CollectionReference<CollectionTypes[N]> {
  return adminDb()
    .collection(name)
    .withConverter(
      converter<CollectionTypes[N] & DocumentData>()
    ) as CollectionReference<CollectionTypes[N]>;
}

/** Pega el id del snapshot a sus datos, para listas que lo necesitan. */
export function withId<T>(snapshot: QueryDocumentSnapshot<T>): WithId<T> {
  return { ...snapshot.data(), id: snapshot.id };
}

/** Timestamp del server: lo pone Firestore, no el reloj de esta instancia. */
export const now = () => FieldValue.serverTimestamp();

export { FieldValue, Timestamp };
