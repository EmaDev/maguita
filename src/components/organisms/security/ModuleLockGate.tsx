"use client";

import { useState, useSyncExternalStore } from "react";
import { PinLock } from "lib-kit-components";
import { APP_NAME } from "@/lib/app-config";
import { verifyPinAction } from "@/lib/data/profile-actions";
import { isUnlockedThisSession, markUnlockedThisSession } from "@/lib/security/session-unlock";

interface ModuleLockGateProps {
  /** Id estable del módulo/mini-app, el mismo que usa `lockedModules` (ver `UserPreferences`). */
  moduleId: string;
  /** Nombre visible en el hint de la pantalla de bloqueo, ej. "Movimientos". */
  moduleLabel: string;
  /** `preferences.pinHash != null && lockedModules.includes(moduleId)`, ya resuelto por el server. */
  locked: boolean;
  children: React.ReactNode;
}

/** `sessionStorage` no dispara ningún evento en la propia pestaña (el evento `storage` sólo avisa a las otras), así que no hay nada a lo que suscribirse. */
const noSubscribe = () => () => {};

/**
 * Gate de acceso para un módulo/mini-app con PinLock activo. Sin candado
 * (`locked === false`) es un passthrough. Con candado, tapa el contenido con
 * `PinLock` hasta verificar el PIN contra `verifyPinAction`, y recuerda el
 * desbloqueo en `sessionStorage` para no volver a pedirlo mientras la
 * pestaña/app siga abierta.
 */
export function ModuleLockGate({ moduleId, moduleLabel, locked, children }: ModuleLockGateProps) {
  // Lectura inicial de sessionStorage sin mismatch de hidratación (mismo
  // patrón que `useGreeting` en `AppShell.tsx`): el server no tiene
  // sessionStorage, así que `getServerSnapshot` devuelve `false` y el
  // cliente pasa al valor real ya en el primer render post-hidratación.
  const sessionUnlocked = useSyncExternalStore(
    noSubscribe,
    () => isUnlockedThisSession(moduleId),
    () => false
  );
  // El desbloqueo logrado en este mismo render (tras `onSuccess`) no vive en
  // sessionStorage hasta que se escribe, y no hace falta releerlo: alcanza
  // con este estado local.
  const [justUnlocked, setJustUnlocked] = useState(false);

  if (!locked || sessionUnlocked || justUnlocked) return <>{children}</>;

  return (
    <PinLock
      open
      mode="pin"
      length={4}
      appName={APP_NAME}
      title="Bloqueado"
      hint={`Ingresá tu PIN para ver ${moduleLabel}.`}
      onUnlock={verifyPinAction}
      onSuccess={() => {
        markUnlockedThisSession(moduleId);
        setJustUnlocked(true);
      }}
    />
  );
}
