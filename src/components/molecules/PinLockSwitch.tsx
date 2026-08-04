"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Switch, useSnackbar } from "lib-kit-components";
import { ROUTES } from "@/lib/app-config";
import { setModuleLockAction } from "@/lib/data/profile-actions";

interface PinLockSwitchProps {
  moduleId: string;
  locked: boolean;
  /** Si ya hay un PIN configurado en Ajustes. Sin PIN, el switch queda deshabilitado. */
  pinConfigured: boolean;
}

/**
 * Interruptor "Bloquear con PIN" reutilizable, para meter dentro del sheet de
 * ajustes de cualquier módulo/mini-app. Pintado optimista, igual que el resto
 * de los toggles de la app (ver `useNotificationInbox` en `AppShell.tsx`).
 */
export function PinLockSwitch({ moduleId, locked, pinConfigured }: PinLockSwitchProps) {
  const { snack } = useSnackbar();
  const [, startTransition] = useTransition();
  const [optimisticLocked, setOptimisticLocked] = useOptimistic(locked);

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimisticLocked(next);
      try {
        await setModuleLockAction(moduleId, next);
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el cambio.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Switch
        checked={pinConfigured ? optimisticLocked : false}
        onChange={toggle}
        disabled={!pinConfigured}
        label="Bloquear con PIN"
        description="Pide el PIN de la cuenta para entrar acá."
      />
      {!pinConfigured && (
        <p className="text-xs text-muted">
          Configurá un PIN en{" "}
          <Link href={ROUTES.ajustes} className="underline">
            Ajustes
          </Link>{" "}
          para poder activar el bloqueo.
        </p>
      )}
    </div>
  );
}
