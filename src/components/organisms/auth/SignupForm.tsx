"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Checkbox, Input } from "lib-kit-components";
import { MailIcon, UserIcon } from "@/components/atoms/icons";
import { PasswordField } from "@/components/molecules/PasswordField";
import { FormAlert } from "@/components/molecules/FormAlert";
import { OrDivider } from "@/components/molecules/OrDivider";
import { GoogleSignInButton } from "@/components/organisms/auth/GoogleSignInButton";
import { signup } from "@/lib/auth/actions";
import { EMPTY_STATE } from "@/lib/auth/validation";
import { ROUTES } from "@/lib/app-config";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, EMPTY_STATE);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-4">
      {(state.message || googleError) && (
        <FormAlert tone="danger">{state.message ?? googleError}</FormAlert>
      )}

      <Input
        name="name"
        label="Nombre y apellido"
        autoComplete="name"
        leftIcon={<UserIcon />}
        defaultValue={state.values?.name}
        error={state.errors?.name}
      />

      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        leftIcon={<MailIcon />}
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />

      <PasswordField
        name="password"
        label="Contraseña"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con una letra y un número."
        error={state.errors?.password}
      />

      <PasswordField
        name="confirm"
        label="Repetir contraseña"
        autoComplete="new-password"
        error={state.errors?.confirm}
      />

      <div className="pt-1">
        {/* `Checkbox` es controlado y no renderiza un input nativo, así que el
            valor viaja al FormData por este hidden. */}
        <input type="hidden" name="terms" value={acceptedTerms ? "on" : ""} />
        <Checkbox
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          label="Acepto los términos y la política de privacidad"
          error={state.errors?.terms}
        />
      </div>

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Crear cuenta
      </Button>

      <OrDivider />

      <GoogleSignInButton onError={setGoogleError} />

      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
