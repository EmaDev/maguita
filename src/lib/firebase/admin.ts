import "server-only";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Firebase Admin — el único punto del server que habla con Firebase.
 *
 * Corre con privilegios totales (saltea las security rules), así que este
 * módulo es `server-only`: si alguna vez lo importa un Client Component, el
 * build falla en vez de filtrar la service account al browser.
 *
 * `firebase-admin` ya viene en la lista de `serverExternalPackages` por defecto
 * de Next, así que no hay que tocar `next.config.ts`: se carga con el `require`
 * nativo de Node en lugar de bundlearse.
 */

const APP_NAME = "maguita";

/**
 * En dev, Next reevalúa los módulos en cada hot reload. Sin este cache global
 * cada recarga crearía una app y un pool de conexiones nuevos hasta que
 * Firestore empieza a tirar errores de "too many connections".
 */
const cached = globalThis as typeof globalThis & {
  __maguitaFirebase?: { app: App; db: Firestore };
};

/** `true` si hay credenciales suficientes para inicializar el Admin SDK. */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // Sin JSON explícito caemos en las Application Default Credentials, que es lo
  // que ya está disponible cuando la app corre en Cloud Run / App Engine.
  if (!raw) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return { credential: applicationDefault(), projectId: projectId() };
    }
    throw new Error(
      "Falta FIREBASE_SERVICE_ACCOUNT_JSON. Generá una clave privada en " +
        "Firebase Console → Configuración del proyecto → Cuentas de servicio y " +
        "pegá el JSON completo en una sola línea. Ver .env.example."
    );
  }

  let parsed: ServiceAccount & { private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido. Tiene que ser el " +
        "archivo de la service account entero, en una sola línea y entre comillas."
    );
  }

  /* La private key trae saltos de línea reales. Al pegarla en un `.env` quedan
     escapados como `\n` literales y `cert()` la rechaza, así que los
     restauramos. */
  const privateKey = (parsed.privateKey ?? parsed.private_key)?.replace(
    /\\n/g,
    "\n"
  );

  return {
    credential: cert({ ...parsed, privateKey }),
    projectId: projectId() ?? parsed.projectId,
  };
}

function projectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    undefined
  );
}

function bootstrap() {
  if (cached.__maguitaFirebase) return cached.__maguitaFirebase;

  const existing = getApps().find((instance) => instance.name === APP_NAME);
  const app = existing ?? initializeApp(credentials(), APP_NAME);
  const db = getFirestore(app);

  try {
    /* Sin esto, escribir un objeto con una propiedad opcional en `undefined`
       tira error en vez de omitir el campo.
       `settings()` sólo se puede llamar antes de la primera operación: si la
       app ya existía (hot reload que perdió el cache global) puede tirar, y ahí
       el Firestore ya está configurado de la vuelta anterior. */
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Ya estaba inicializado.
  }

  cached.__maguitaFirebase = { app, db };
  return cached.__maguitaFirebase;
}

/** App de Admin, inicializada la primera vez que se la pide. */
export function adminApp(): App {
  return bootstrap().app;
}

/** Firebase Auth del lado server: sesiones, alta y edición de usuarios. */
export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** Firestore del lado server. Preferí los helpers tipados de `./collections`. */
export function adminDb(): Firestore {
  return bootstrap().db;
}

/** Cloud Storage del lado server. Preferí los helpers de `./storage`. */
export function adminStorage(): Storage {
  return getStorage(adminApp());
}
