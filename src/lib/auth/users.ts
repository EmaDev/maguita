import "server-only";
import { createHash, randomInt } from "node:crypto";
import { FirebaseAuthError } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  collection,
  DEFAULT_PREFERENCES,
  now,
  Timestamp,
} from "@/lib/firebase/collections";

/**
 * Cuentas de la app.
 *
 * La fuente de verdad de la identidad es **Firebase Auth**: ahí viven el email,
 * la contraseña (hasheada por Google con scrypt) y el `uid`. Firestore guarda
 * en paralelo un documento de perfil por usuario en `users`, que es donde va a
 * colgar todo lo que Auth no sabe (preferencias, plan, metadata de la app).
 *
 * Los dos se crean juntos en `createAccount`, y el `uid` es la clave que los une.
 */

export interface Account {
  /** `uid` de Firebase Auth. También es el id del documento en `users`. */
  id: string;
  email: string;
  name: string;
}

const normalize = (email: string) => email.trim().toLowerCase();

/** ¿El error del Admin SDK tiene este código de Firebase? */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof FirebaseAuthError && error.code === code;
}

export async function findByEmail(email: string): Promise<Account | null> {
  try {
    const user = await adminAuth().getUserByEmail(normalize(email));
    return {
      id: user.uid,
      email: user.email ?? normalize(email),
      name: user.displayName ?? "",
    };
  } catch (error) {
    if (hasCode(error, "auth/user-not-found")) return null;
    throw error;
  }
}

/** Se lanza cuando el email ya está tomado, para que la action lo distinga. */
export class EmailTakenError extends Error {
  constructor() {
    super("EMAIL_TAKEN");
    this.name = "EmailTakenError";
  }
}

/**
 * Da de alta la cuenta en Firebase Auth y su perfil en Firestore.
 *
 * Si falla la escritura del perfil borramos el usuario de Auth: dejarlo a medio
 * crear haría que el email quede tomado por una cuenta con la que después no se
 * puede entrar.
 */
export async function createAccount(input: {
  email: string;
  name: string;
  password: string;
}): Promise<Account> {
  const email = normalize(input.email);
  const name = input.name.trim();

  let uid: string;
  try {
    const user = await adminAuth().createUser({
      email,
      password: input.password,
      displayName: name,
    });
    uid = user.uid;
  } catch (error) {
    if (hasCode(error, "auth/email-already-exists")) throw new EmailTakenError();
    throw error;
  }

  try {
    await collection(COLLECTIONS.users).doc(uid).set({
      email,
      name,
      alias: null,
      avatarUrl: null,
      preferences: DEFAULT_PREFERENCES,
      createdAt: now(),
      updatedAt: now(),
    });
  } catch (error) {
    await adminAuth().deleteUser(uid).catch(() => {});
    throw error;
  }

  return { id: uid, email, name };
}

/**
 * Verifica el ID token que devuelve el popup de Google y resuelve la cuenta.
 *
 * Firebase Auth ya crea el usuario de Auth solo en el primer login federado
 * (eso es lo que hace del alta por Google "automática"); lo único que falta es
 * el documento de perfil en `users`, que sí es cosa nuestra — se crea acá si
 * todavía no existe, sin pisar el de alguien que ya haya entrado antes.
 */
export async function findOrCreateGoogleAccount(idToken: string): Promise<Account> {
  const decoded = await adminAuth().verifyIdToken(idToken);
  if (!decoded.email) {
    throw new Error("La cuenta de Google no tiene un email asociado.");
  }

  const uid = decoded.uid;
  const email = normalize(decoded.email);
  const name = (typeof decoded.name === "string" ? decoded.name.trim() : "") || email;
  const avatarUrl = typeof decoded.picture === "string" ? decoded.picture : null;

  const ref = collection(COLLECTIONS.users).doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.set({
      email,
      name,
      alias: null,
      avatarUrl,
      preferences: DEFAULT_PREFERENCES,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  return { id: uid, email, name };
}

export async function updatePassword(uid: string, password: string): Promise<void> {
  await adminAuth().updateUser(uid, { password });
  /* Cerramos las sesiones abiertas: cambiar la contraseña tiene que echar a
     quien haya entrado con la anterior. */
  await adminAuth().revokeRefreshTokens(uid);
}

/* ------------------------------------------------------------------ *
 * Códigos de recuperación de contraseña
 * ------------------------------------------------------------------ */

const RESET_TTL_MS = 15 * 60 * 1000;

/**
 * El código nunca se guarda en claro: la clave del documento es el hash de
 * `email:código`. Alguien con acceso de lectura a la colección ve que hay un
 * pedido pendiente, pero no puede usarlo.
 */
const codeKey = (email: string, code: string) =>
  createHash("sha256").update(`${normalize(email)}:${code}`).digest("hex");

/**
 * Genera un código de 6 dígitos para el email, si la cuenta existe.
 *
 * Devuelve `null` cuando no hay cuenta — la action responde lo mismo en los dos
 * casos para no filtrar qué emails están registrados.
 *
 * TODO: enviar el código por mail. Firebase Auth manda un *link* de
 * recuperación, no un código de 6 dígitos, así que este flujo necesita un
 * proveedor de email propio (Resend, SendGrid, …) enganchado acá.
 */
export async function createResetCode(email: string): Promise<string | null> {
  const account = await findByEmail(email);
  if (!account) return null;

  // `randomInt` es criptográficamente seguro y no tiene el sesgo del módulo.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await collection(COLLECTIONS.passwordResetCodes)
    .doc(codeKey(account.email, code))
    .set({
      uid: account.id,
      email: account.email,
      expiresAt: Timestamp.fromMillis(Date.now() + RESET_TTL_MS),
      createdAt: now(),
    });

  return code;
}

/**
 * Canjea un código. Devuelve el `uid` si era válido, `null` si no.
 * El documento se borra pase lo que pase: un código es de un solo uso, y así un
 * intento fallido tampoco deja el código vivo para seguir probando.
 */
export async function consumeResetCode(
  email: string,
  code: string
): Promise<string | null> {
  const ref = collection(COLLECTIONS.passwordResetCodes).doc(codeKey(email, code));
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;

  await ref.delete();

  const data = snapshot.data()!;
  if (data.expiresAt.toMillis() < Date.now()) return null;
  return data.uid;
}
