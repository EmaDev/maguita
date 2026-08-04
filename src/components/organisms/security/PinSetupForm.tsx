"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Button, Input, useSnackbar } from "lib-kit-components";
import { setPinAction } from "@/lib/data/profile-actions";

/** Sólo dígitos, tope 4 — mismo largo que espera `PinLock`/`setPinAction`. */
const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

interface PinSetupFormProps {
  /** Si ya hay un PIN configurado en la cuenta. */
  pinSet: boolean;
}

/**
 * Alta/cambio/baja del PIN compartido de PinLock. Vive en Ajustes > Seguridad
 * — es el único lugar donde se define el PIN; activarlo/desactivarlo por
 * módulo se hace desde cada mini-app/tab (`PinLockSwitch`).
 */
export function PinSetupForm({ pinSet }: PinSetupFormProps) {
  const { snack } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setEditing(false);
    setPin("");
    setConfirmPin("");
  }

  function save() {
    if (pin.length !== 4) {
      snack({ message: "El PIN tiene que ser de 4 dígitos.", variant: "error" });
      return;
    }
    if (pin !== confirmPin) {
      snack({ message: "Los PIN no coinciden.", variant: "error" });
      return;
    }
    startTransition(async () => {
      try {
        await setPinAction(pin);
        snack({ message: "PIN guardado.", variant: "success" });
        reset();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el PIN.",
          variant: "error",
        });
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await setPinAction(null);
        snack({ message: "PIN desactivado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo quitar el PIN.",
          variant: "error",
        });
      }
    });
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted leading-relaxed">
          {pinSet
            ? "Hay un PIN activo. Se usa para bloquear Movimientos, Notas, Hábitos y las mini-apps que elijas."
            : "Activá un PIN de 4 dígitos para poder bloquear Movimientos, Notas, Hábitos y mini-apps privadas."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {pinSet ? "Cambiar PIN" : "Activar PIN"}
          </Button>
          {pinSet && (
            <Button variant="danger" size="sm" onClick={remove} loading={pending}>
              Quitar PIN
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        label="PIN nuevo"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPin(onlyDigits(e.target.value))}
      />
      <Input
        label="Confirmar PIN"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={confirmPin}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPin(onlyDigits(e.target.value))}
      />
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={reset} disabled={pending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} loading={pending}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
