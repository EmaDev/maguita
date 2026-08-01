"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "./config";

/**
 * SDK de Firebase para el browser.
 *
 * La sesión de la app **no** vive acá: la maneja el server con una cookie
 * `httpOnly` (ver `lib/auth/session.ts`), que es lo que permite proteger las
 * pantallas en el render en vez de esperar a que hidrate el cliente.
 *
 * Este módulo es para lo que sólo puede pasar en el browser: Cloud Messaging,
 * y más adelante listeners en tiempo real de Firestore (`onSnapshot`), que
 * corren con las security rules del proyecto.
 *
 * Todo es lazy: importar el módulo no inicializa nada, así el SDK no entra en
 * el bundle inicial de pantallas que no lo usan.
 */

const APP_NAME = "maguita-client";

function ensureConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase no está configurado. Completá las variables " +
        "NEXT_PUBLIC_FIREBASE_* en tu .env.local (ver .env.example)."
    );
  }
}

export function firebaseApp(): FirebaseApp {
  ensureConfigured();
  const existing = getApps().find((instance) => instance.name === APP_NAME);
  return existing ?? initializeApp(firebaseConfig, APP_NAME);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(firebaseApp());
}

export { getApp, isFirebaseConfigured };
