import "server-only";
import {
  COLLECTIONS,
  collection,
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/firebase/collections";

/**
 * Perfil de cuenta, para pantallas que necesitan más que lo que trae la
 * session cookie (alias, avatar, preferencias). `createAccount` y
 * `findOrCreateGoogleAccount` (`lib/auth/users.ts`) son quienes lo crean.
 */
export interface Profile {
  id: string;
  email: string;
  name: string;
  alias: string | null;
  avatarUrl: string | null;
  preferences: UserPreferences;
}

/**
 * `null` sólo debería pasar si el `uid` de la sesión no tiene perfil — no
 * debería ocurrir en la práctica, ya que Auth y el perfil se crean juntos.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const snapshot = await collection(COLLECTIONS.users).doc(userId).get();
  const data = snapshot.data();
  if (!data) return null;

  return {
    id: userId,
    email: data.email,
    name: data.name,
    // `??` cubre documentos creados antes de que estos campos existieran.
    alias: data.alias ?? null,
    avatarUrl: data.avatarUrl ?? null,
    preferences: data.preferences ?? DEFAULT_PREFERENCES,
  };
}
