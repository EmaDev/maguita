import "server-only";
import { firebaseConfig } from "@/lib/firebase/config";

/**
 * Cliente mínimo de la REST API de Identity Toolkit.
 *
 * El Admin SDK deliberadamente no puede verificar contraseñas: sabe crear y
 * editar usuarios, pero no "iniciar sesión". Para eso Firebase expone esta REST
 * API, que es la misma que usa el SDK del browser por debajo.
 *
 * Usarla desde el server es lo que deja el login como una Server Action común:
 * la contraseña nunca se expone al cliente ni hay que arrastrar el SDK de auth
 * al bundle sólo para poder ingresar.
 */

/**
 * Con el emulador de Auth corriendo, los SDK de Firebase leen esta variable y
 * redirigen ahí. Replicamos ese comportamiento para que el login local funcione
 * contra el emulador en vez de contra el proyecto real.
 */
function endpoint(): string {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";
  return `${base}/v1/accounts`;
}

export class IdentityError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "IdentityError";
  }
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_FIREBASE_API_KEY: sin la Web API key no se puede " +
        "validar la contraseña contra Firebase Auth."
    );
  }

  const response = await fetch(
    `${endpoint()}:${method}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Es una llamada de autenticación: nunca se cachea ni se reusa.
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    /* Firebase devuelve el motivo en `error.message`, a veces con detalle
       después de un `:` (ej. "TOO_MANY_ATTEMPTS_TRY_LATER : Access blocked"). */
    const raw = String(payload?.error?.message ?? "UNKNOWN_ERROR");
    throw new IdentityError(raw.split(":")[0]!.trim());
  }

  return payload as T;
}

export interface SignInResult {
  /** ID token fresco, el insumo de `createSessionCookie`. */
  idToken: string;
  localId: string;
  email: string;
  displayName: string;
}

/**
 * Valida email + contraseña contra Firebase Auth.
 * Lanza `IdentityError` con el código de Firebase si no coinciden.
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  return call<SignInResult>("signInWithPassword", {
    email: email.trim(),
    password,
    returnSecureToken: true,
  });
}

/**
 * Códigos de error de Identity Toolkit que significan "las credenciales no
 * sirven". Se agrupan a propósito en un solo mensaje para el usuario: distinguir
 * "no existe el email" de "contraseña incorrecta" le confirma a cualquiera qué
 * direcciones están registradas.
 */
const BAD_CREDENTIALS = new Set([
  "INVALID_LOGIN_CREDENTIALS",
  "INVALID_PASSWORD",
  "EMAIL_NOT_FOUND",
  "INVALID_EMAIL",
  "MISSING_PASSWORD",
]);

/** Traduce un error de Identity Toolkit al mensaje que ve el usuario. */
export function identityMessage(error: unknown): string {
  const code = error instanceof IdentityError ? error.code : "";

  if (BAD_CREDENTIALS.has(code)) return "Email o contraseña incorrectos.";
  if (code === "USER_DISABLED") return "Esta cuenta está deshabilitada.";
  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return "Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.";
  }
  if (code === "PASSWORD_LOGIN_DISABLED") {
    return "El ingreso con contraseña está deshabilitado en Firebase Auth.";
  }
  return "No pudimos completar el ingreso. Probá de nuevo en un momento.";
}
