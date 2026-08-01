/**
 * Config pública de Firebase (la del "Web app" de la consola).
 *
 * Estas claves son públicas por diseño: viajan en el bundle del browser y no
 * son un secreto — lo que protege los datos son las security rules de Firestore
 * y la verificación de sesión del server, no ocultar la apiKey.
 *
 * Este módulo NO es `server-only` a propósito: lo usan tanto el SDK del browser
 * como las llamadas REST a Identity Toolkit desde el server.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
} as const;

/** Clave para suscribirse a push (Firebase Console → Cloud Messaging). */
export const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

/**
 * `true` si la config alcanza para inicializar el SDK. Permite que la app
 * arranque sin Firebase configurado en vez de explotar en el primer render.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);
