"use client";

import { useId, type ChangeEvent } from "react";

/**
 * Input de un monto en pesos enteros (mismo criterio que `Movement.amount`:
 * sin decimales), formateado con separador de miles en vivo mientras se
 * escribe — a diferencia de `Input` de `lib-kit-components`, que muestra el
 * texto crudo tal cual lo tipea el usuario.
 *
 * No puede ser `type="number"`: los inputs numéricos nativos no soportan un
 * valor formateado con puntos de miles (el navegador lo rechaza como
 * inválido). Por eso es `type="text"` con `inputMode="numeric"` — mismo
 * teclado numérico en mobile, pero el valor mostrado es texto formateado.
 */
interface AmountInputProps {
  label?: string;
  /** `0` se muestra vacío, no "0" — evita forzar al usuario a borrarlo. */
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

export function AmountInput({
  label,
  value,
  onChange,
  disabled,
  hint,
  error,
  className = "",
}: AmountInputProps) {
  const id = useId();
  const display = value > 0 ? value.toLocaleString("es-AR") : "";

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits === "" ? 0 : Number(digits));
  }

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-foreground">
          {label}
        </label>
      )}
      <div
        className={[
          "flex items-center rounded-xl border-2 bg-surface transition-colors",
          error
            ? "border-danger"
            : "border-border focus-within:border-primary hover:border-muted/40",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <span className="pl-4 text-lg font-semibold text-muted">$</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0"
          className={[
            "w-full bg-transparent py-3.5 pl-2 pr-4 text-lg font-semibold text-foreground",
            "outline-none tabular-nums placeholder:text-muted disabled:cursor-not-allowed",
          ].join(" ")}
        />
      </div>
      {(error || hint) && (
        <p className={`mt-1.5 pl-1 text-xs ${error ? "text-danger" : "text-muted"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
