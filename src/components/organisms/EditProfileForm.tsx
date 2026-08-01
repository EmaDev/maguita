"use client";

import { useActionState } from "react";
import { Button, Input } from "lib-kit-components";
import { AvatarPicker } from "@/components/molecules/AvatarPicker";
import { FormAlert } from "@/components/molecules/FormAlert";
import { updateProfileAction } from "@/lib/data/profile-actions";
import { EMPTY_STATE } from "@/lib/auth/validation";
import type { Profile } from "@/lib/data/profile";

export function EditProfileForm({
  profile,
  initials,
}: {
  profile: Profile;
  initials: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, EMPTY_STATE);

  return (
    <form action={formAction} className="space-y-5">
      {state.message && <FormAlert tone="danger">{state.message}</FormAlert>}
      {state.notice && <FormAlert tone="success">{state.notice}</FormAlert>}

      <div className="flex justify-center">
        <AvatarPicker
          name="avatar"
          initials={initials}
          initialUrl={profile.avatarUrl}
          error={state.errors?.avatar}
        />
      </div>

      <Input
        name="name"
        label="Nombre y apellido"
        autoComplete="name"
        defaultValue={state.values?.name ?? profile.name}
        error={state.errors?.name}
      />

      <Input
        name="alias"
        label="Alias"
        hint="Apodo opcional, sólo para vos."
        autoComplete="nickname"
        defaultValue={state.values?.alias ?? profile.alias ?? ""}
        error={state.errors?.alias}
      />

      <Input
        label="Email"
        value={profile.email}
        disabled
        readOnly
        hint="El email no se puede editar desde acá."
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
