import type { ReactNode } from "react";

const TONES = {
  danger: "bg-danger/10 text-danger border-danger/25",
  success: "bg-success/10 text-success border-success/25",
  info: "bg-primary/10 text-primary border-primary/25",
} as const;

/** Mensaje de estado a nivel formulario (no de un campo puntual). */
export function FormAlert({
  tone = "info",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
