"use client";

import { useState } from "react";
import { Input } from "lib-kit-components";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/atoms/icons";

interface PasswordFieldProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  defaultValue?: string;
}

/** Input de contraseña con botón para revelarla. */
export function PasswordField({
  name,
  label,
  error,
  hint,
  autoComplete = "current-password",
  defaultValue,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      name={name}
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      defaultValue={defaultValue}
      error={error}
      hint={hint}
      leftIcon={<LockIcon />}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="grid place-items-center w-8 h-8 -m-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
