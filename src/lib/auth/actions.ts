"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/app-config";
import { IdentityError, identityMessage, signInWithPassword } from "./identity";
import { createSession, deleteSession } from "./session";
import {
  EmailTakenError,
  consumeResetCode,
  createAccount,
  createResetCode,
  findOrCreateGoogleAccount,
  updatePassword,
} from "./users";
import {
  collect,
  safeNext,
  validateCode,
  validateEmail,
  validateName,
  validatePassword,
  type AuthFormState,
} from "./validation";

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "");

/**
 * Convierte un fallo inesperado en un mensaje para el usuario.
 *
 * Los errores de Firebase suelen traer detalles de infraestructura (proyecto,
 * credenciales, cuotas) que no tienen por qué salir a la pantalla, así que van
 * al log del server y el usuario ve algo genérico.
 */
function unexpected(error: unknown, context: string): AuthFormState {
  console.error(`[maguita:auth] ${context}`, error);
  return {
    message: "Algo falló de nuestro lado. Probá de nuevo en un momento.",
  };
}

export async function login(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const next = safeNext(field(formData, "next") || null, ROUTES.inicio);

  const errors = collect({
    email: validateEmail(email) ?? "",
    password: password ? "" : "Ingresá tu contraseña.",
  });
  if (errors) return { errors, values: { email } };

  try {
    /* Firebase valida la contraseña y devuelve un ID token fresco, que
       `createSession` canjea por la session cookie `httpOnly`. */
    const { idToken } = await signInWithPassword(email, password);
    await createSession(idToken);
  } catch (error) {
    if (error instanceof IdentityError) {
      // El mensaje no distingue "no existe" de "contraseña mal" a propósito.
      return { message: identityMessage(error), values: { email } };
    }
    return { ...unexpected(error, "login"), values: { email } };
  }

  // Fuera del try: `redirect` funciona lanzando, y el catch se lo comería.
  redirect(next);
}

export async function signup(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  const errors = collect({
    name: validateName(name) ?? "",
    email: validateEmail(email) ?? "",
    password: validatePassword(password) ?? "",
    confirm: password !== confirm ? "Las contraseñas no coinciden." : "",
    terms: formData.get("terms") ? "" : "Tenés que aceptar los términos.",
  });
  if (errors) return { errors, values: { name, email } };

  try {
    /* Sin chequeo previo de "¿existe el email?": Firebase Auth lo resuelve en
       el alta y así no hay ventana para que dos altas simultáneas pasen las dos. */
    await createAccount({ name, email, password });

    // El alta no devuelve ID token, así que iniciamos sesión para obtenerlo.
    const { idToken } = await signInWithPassword(email, password);
    await createSession(idToken);
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return {
        errors: { email: "Ya existe una cuenta con ese email." },
        values: { name, email },
      };
    }
    if (error instanceof IdentityError) {
      return { ...unexpected(error, "signup:signin"), values: { name, email } };
    }
    return { ...unexpected(error, "signup"), values: { name, email } };
  }

  redirect(ROUTES.inicio);
}

/**
 * Ingreso (y alta automática) con Google.
 *
 * El popup corre en el cliente porque `signInWithPopup` necesita el `window`
 * del browser; esta action sólo recibe el ID token que ya emitió Firebase y
 * repite el mismo canje por session cookie que usa `login`. La cuenta de Auth
 * la crea Firebase solo en el primer ingreso — acá sólo falta el perfil de
 * Firestore, que resuelve `findOrCreateGoogleAccount`.
 */
export async function loginWithGoogle(
  idToken: string,
  next?: string
): Promise<AuthFormState> {
  try {
    await findOrCreateGoogleAccount(idToken);
    await createSession(idToken);
  } catch (error) {
    return unexpected(error, "loginWithGoogle");
  }

  redirect(safeNext(next ?? null, ROUTES.inicio));
}

/** Paso 1 de la recuperación: pedir el código. */
export async function requestResetCode(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = field(formData, "email");

  const emailError = validateEmail(email);
  if (emailError) return { errors: { email: emailError }, values: { email } };

  let code: string | null;
  try {
    code = await createResetCode(email);
  } catch (error) {
    return { ...unexpected(error, "requestResetCode"), values: { email } };
  }

  /* Respondemos igual exista o no la cuenta, para no filtrar qué emails están
     registrados. Falta el envío por mail (ver el TODO en `users.ts`); mientras
     tanto el código se loguea en dev para poder probar el flujo. */
  if (code && process.env.NODE_ENV !== "production") {
    console.info(`[maguita] código de recuperación para ${email}: ${code}`);
  }

  return {
    ok: true,
    notice: "Si el email está registrado, te enviamos un código de 6 dígitos.",
    values: { email },
  };
}

/** Paso 2 y 3: validar el código y guardar la contraseña nueva. */
export async function confirmPasswordReset(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const code = field(formData, "code");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  const errors = collect({
    code: validateCode(code) ?? "",
    password: validatePassword(password) ?? "",
    confirm: password !== confirm ? "Las contraseñas no coinciden." : "",
  });
  if (errors) return { errors, values: { email } };

  try {
    const uid = await consumeResetCode(email, code);
    if (!uid) {
      return {
        errors: { code: "El código es incorrecto o venció." },
        values: { email },
      };
    }
    await updatePassword(uid, password);
  } catch (error) {
    return { ...unexpected(error, "confirmPasswordReset"), values: { email } };
  }

  redirect(`${ROUTES.login}?reset=1`);
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect(ROUTES.login);
}
