import type { ReactNode } from "react";

interface SettingsRowProps {
  /** Ícono chico, se muestra dentro de un chip circular. Para un avatar u otro elemento ya armado, usá `leading`. */
  icon?: ReactNode;
  /** Elemento a la izquierda ya armado (ej. `UserAvatar`), sin el chip circular que envuelve a `icon`. */
  leading?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  /** Contenido a la derecha (ej. `ChevronRightIcon` para una fila navegable). */
  trailing?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}

/**
 * Fila de una lista de ajustes: algo a la izquierda + label/descripción +
 * algo a la derecha. Sólo layout — la interactividad (navegar, submit de un
 * form) la decide quien la envuelve (`button`, `form`), así sirve tanto para
 * filas clickeables como estáticas dentro de la misma `Card` con `divide-y`.
 */
export function SettingsRow({
  icon,
  leading,
  label,
  description,
  trailing,
  tone = "default",
  className = "",
}: SettingsRowProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {leading}
      {icon && (
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            tone === "danger" ? "bg-danger/12 text-danger" : "bg-surface-alt text-muted"
          }`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${tone === "danger" ? "text-danger" : ""}`}>
          {label}
        </p>
        {description && <p className="mt-0.5 truncate text-xs text-muted">{description}</p>}
      </div>
      {trailing}
    </div>
  );
}
