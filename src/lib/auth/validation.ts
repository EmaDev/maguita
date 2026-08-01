/** Validaciones compartidas entre las Server Actions y el estado de los formularios. */

export type FieldErrors = Record<string, string>;

export interface AuthFormState {
  /** `true` cuando el paso terminó bien (lo usan los formularios multi-paso). */
  ok?: boolean;
  /** Error general (credenciales inválidas, fallo inesperado). */
  message?: string;
  /** Éxito informativo (ej. "te enviamos el código"). */
  notice?: string;
  errors?: FieldErrors;
  /** Valores tipeados, para no vaciar el formulario cuando hay error. */
  values?: Record<string, string>;
}

export const EMPTY_STATE: AuthFormState = {};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Ingresá tu email.";
  if (!EMAIL_RE.test(value.trim())) return "Ese email no parece válido.";
  return null;
}

export function validateName(value: string): string | null {
  if (!value.trim()) return "Ingresá tu nombre.";
  if (value.trim().length < 2) return "El nombre debe tener al menos 2 caracteres.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Ingresá una contraseña.";
  if (value.length < 8) return "Usá al menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(value)) return "Incluí al menos una letra.";
  if (!/[0-9]/.test(value)) return "Incluí al menos un número.";
  return null;
}

export function validateCode(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return "El código tiene 6 dígitos.";
  return null;
}

/** Descarta las claves sin error para poder chequear `Object.keys(errors).length`. */
export function collect(candidates: FieldErrors): FieldErrors | null {
  const errors = Object.fromEntries(
    Object.entries(candidates).filter(([, message]) => Boolean(message))
  );
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Sólo permite redirigir a rutas internas: sin esto, un `?next=https://…`
 * convertiría el login en un open redirect.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
