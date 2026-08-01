import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

/**
 * Sesión basada en **session cookies de Firebase**.
 *
 * El ID token que devuelve Firebase Auth dura una hora y, guardado en el
 * browser, queda al alcance de cualquier script de la página. En vez de eso lo
 * canjeamos por una session cookie: la firma Google, dura hasta 14 días, se
 * guarda `httpOnly` y se puede revocar desde el server. Es el patrón que
 * Firebase recomienda para apps renderizadas en el servidor.
 *
 * Verificarla no necesita red: la firma se chequea contra las claves públicas
 * de Google, que el Admin SDK cachea.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días (Firebase admite hasta 14).

export interface SessionPayload {
  /** `uid` de Firebase Auth. */
  sub: string;
  email: string;
  name: string;
  /** Expiración en segundos epoch. */
  exp: number;
}

/** Normaliza el token decodificado a la forma que usa el resto de la app. */
function toPayload(decoded: DecodedIdToken): SessionPayload | null {
  if (!decoded.uid || !decoded.email) return null;
  return {
    sub: decoded.uid,
    email: decoded.email,
    /* El displayName viaja como claim `name`. Si la cuenta no tiene, el email
       alcanza para que el avatar y el saludo muestren algo razonable. */
    name: decoded.name?.trim() || decoded.email,
    exp: decoded.exp,
  };
}

/**
 * Canjea un ID token recién emitido por una session cookie y la guarda.
 * Firebase rechaza tokens de más de 5 minutos, así que esto sólo sirve
 * inmediatamente después de un login o un alta.
 */
export async function createSession(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: MAX_AGE_SECONDS * 1000, // Firebase lo espera en milisegundos.
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Cierra la sesión. Además de borrar la cookie revoca los refresh tokens del
 * usuario, que es lo que invalida las sesiones abiertas en otros dispositivos —
 * aunque sólo lo notan las verificaciones con `checkRevoked` (ver `dal.ts`).
 */
export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const decoded = await adminAuth().verifySessionCookie(token);
      await adminAuth().revokeRefreshTokens(decoded.uid);
    } catch {
      /* Cookie vencida, inválida o Firebase caído: no hay nada que revocar y
         cerrar sesión tiene que funcionar igual. */
    }
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Lee y valida la sesión del request actual. Devuelve `null` ante cualquier
 * problema: cookie ausente, firma inválida, vencida o revocada.
 *
 * `checkRevoked` le pregunta a Firebase por el estado del usuario, así que
 * agrega un viaje de red. Va en `false` para el render normal y se activa en
 * las operaciones sensibles (ver `requireFreshSession` en `dal.ts`).
 */
export async function getSession(
  checkRevoked = false
): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return toPayload(await adminAuth().verifySessionCookie(token, checkRevoked));
  } catch (error) {
    /* Cookie vencida, revocada o inválida es el caso esperado y se resuelve
       mandando a login. Cualquier otra cosa (credenciales mal, Firebase caído)
       se loguea: si no, una config rota se ve igual que "no hay sesión" y manda
       a todo el mundo al login sin ninguna pista de por qué. */
    const code = (error as { code?: string })?.code;
    if (!code?.startsWith("auth/")) {
      console.error("[maguita:auth] no se pudo verificar la sesión", error);
    }
    return null;
  }
}
