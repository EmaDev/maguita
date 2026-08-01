"use client";

import { MoonIcon, SunIcon } from "@/components/atoms/icons";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

/** Selector de tema de 3 opciones, para la pantalla de Ajustes. */
export function ThemeSegmented() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-alt border border-border"
    >
      {OPTIONS.map((option) => {
        // `mounted` evita marcar la opción equivocada durante la hidratación:
        // el HTML del server no sabe qué hay guardado en el dispositivo.
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Botón compacto claro/oscuro, para headers y pantallas de auth. */
export function ThemeIconButton({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"}
      className={`grid place-items-center w-10 h-10 rounded-xl border border-border bg-surface text-muted hover:text-foreground transition-colors ${className}`}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
