"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, CodeOTP, Input, StepsProgress } from "lib-kit-components";
import { MailIcon } from "@/components/atoms/icons";
import { PasswordField } from "@/components/molecules/PasswordField";
import { FormAlert } from "@/components/molecules/FormAlert";
import { confirmPasswordReset, requestResetCode } from "@/lib/auth/actions";
import { EMPTY_STATE } from "@/lib/auth/validation";
import { ROUTES } from "@/lib/app-config";

const STEPS = ["Email", "Código", "Nueva clave"];

/**
 * Recuperación en dos envíos: primero se pide el código por email, después se
 * validan código + contraseña nueva juntos. Cada paso es una Server Action
 * distinta; el paso actual lo decide `requestState.ok`.
 */
export function PasswordRecoveryForm() {
  const [requestState, requestAction, requesting] = useActionState(
    requestResetCode,
    EMPTY_STATE
  );
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmPasswordReset,
    EMPTY_STATE
  );
  const [code, setCode] = useState("");

  const email = requestState.values?.email ?? "";
  const sent = Boolean(requestState.ok);

  if (!sent) {
    return (
      <form action={requestAction} className="space-y-5">
        <StepsProgress steps={STEPS} current={0} />

        {requestState.message && (
          <FormAlert tone="danger">{requestState.message}</FormAlert>
        )}

        <Input
          name="email"
          type="email"
          label="Email de tu cuenta"
          autoComplete="email"
          inputMode="email"
          leftIcon={<MailIcon />}
          defaultValue={requestState.values?.email}
          error={requestState.errors?.email}
        />

        <Button type="submit" fullWidth size="lg" loading={requesting}>
          Enviarme el código
        </Button>

        <p className="text-center text-sm text-muted">
          <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
            Volver al ingreso
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form action={confirmAction} className="space-y-5">
      <StepsProgress steps={STEPS} current={code.length === 6 ? 2 : 1} />

      {/* El email viene del paso anterior; la action lo necesita para validar
          el código contra la cuenta correcta. */}
      <input type="hidden" name="email" value={email} />
      {/* CodeOTP no renderiza un input con `name`, así que lo espejamos. */}
      <input type="hidden" name="code" value={code} />

      {requestState.notice && !confirmState.message && (
        <FormAlert tone="success">{requestState.notice}</FormAlert>
      )}
      {confirmState.message && (
        <FormAlert tone="danger">{confirmState.message}</FormAlert>
      )}

      <CodeOTP
        label={`Código enviado a ${email}`}
        value={code}
        onChange={setCode}
        length={6}
        type="numeric"
        autoFocus
        error={confirmState.errors?.code}
        hint="Vence en 15 minutos."
      />

      <PasswordField
        name="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con una letra y un número."
        error={confirmState.errors?.password}
      />

      <PasswordField
        name="confirm"
        label="Repetir nueva contraseña"
        autoComplete="new-password"
        error={confirmState.errors?.confirm}
      />

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={confirming}
        disabled={code.length !== 6}
      >
        Cambiar contraseña
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
          Volver al ingreso
        </Link>
      </p>
    </form>
  );
}
