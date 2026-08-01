"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Input } from "lib-kit-components";
import { MailIcon } from "@/components/atoms/icons";
import { PasswordField } from "@/components/molecules/PasswordField";
import { FormAlert } from "@/components/molecules/FormAlert";
import { OrDivider } from "@/components/molecules/OrDivider";
import { GoogleSignInButton } from "@/components/organisms/auth/GoogleSignInButton";
import { login } from "@/lib/auth/actions";
import { EMPTY_STATE } from "@/lib/auth/validation";
import { ROUTES } from "@/lib/app-config";

interface LoginFormProps {
  /** Ruta a la que volver después de ingresar (la pone el proxy en `?next=`). */
  next: string;
  /** Aviso de "contraseña actualizada" al volver del flujo de recuperación. */
  justReset?: boolean;
}

export function LoginForm({ next, justReset }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, EMPTY_STATE);
  const [googleError, setGoogleError] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-4">
      {/* El destino viaja en el form para que la action lo valide en el server. */}
      <input type="hidden" name="next" value={next} />

      {justReset && !state.message && !googleError && (
        <FormAlert tone="success">
          Tu contraseña se actualizó. Ya podés ingresar.
        </FormAlert>
      )}
      {(state.message || googleError) && (
        <FormAlert tone="danger">{state.message ?? googleError}</FormAlert>
      )}

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
        autoComplete="current-password"
        error={state.errors?.password}
      />

      <div className="flex justify-end">
        <Link
          href={ROUTES.recuperar}
          className="text-sm font-medium text-primary hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Ingresar
      </Button>

      <OrDivider />

      <GoogleSignInButton next={next} onError={setGoogleError} />

      <p className="text-center text-sm text-muted">
        ¿No tenés cuenta?{" "}
        <Link href={ROUTES.signin} className="font-medium text-primary hover:underline">
          Creá una
        </Link>
      </p>
    </form>
  );
}
