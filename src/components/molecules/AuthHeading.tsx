import type { ReactNode } from "react";

/** Encabezado común de las pantallas de auth (título + bajada). */
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}
