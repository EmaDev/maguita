import type { Chip } from "lib-kit-components";

/**
 * Paleta fija de emojis para los hábitos. Es una lista cerrada y no un input
 * libre a propósito: el emoji es decorativo y entra en una grilla de ancho
 * fijo, así que dejar pegar cualquier cosa (o texto que no sea un emoji)
 * rompería la alineación de la lista sin aportar nada.
 */
export const HABIT_EMOJIS = [
  "🏃", "💪", "🧘", "📚", "💧", "🥗",
  "😴", "🚭", "🧹", "💰", "🎸", "✍️",
] as const;

export const DEFAULT_HABIT_EMOJI = HABIT_EMOJIS[0];

/** Tope del subtítulo. Mismo criterio que `MAX_SUBTITLE_LENGTH` en `habits-actions`: el server igual lo valida. */
export const MAX_SUBTITLE_LENGTH = 80;

/**
 * Chips de día de semana. El `id` es `Date.getDay()` como string (0=domingo
 * … 6=sábado), que es la convención que guarda `scheduledWeekdays` — así el
 * `ChipCarousel` no necesita traducir entre un índice de UI (lunes primero) y
 * el que entiende el resto del código.
 */
export const WEEKDAY_CHIPS: Chip[] = [
  { id: "1", label: "L" },
  { id: "2", label: "M" },
  { id: "3", label: "M" },
  { id: "4", label: "J" },
  { id: "5", label: "V" },
  { id: "6", label: "S" },
  { id: "0", label: "D" },
];

/** Por default, un hábito nuevo aplica todos los días — mismo comportamiento libre que tenía antes de tener horario. */
export const DEFAULT_SCHEDULED_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * `TimePicker` no expone hacia qué lado abrir su panel (ver la explicación
 * completa en `note-priority.ts`, que tiene el mismo problema). Se duplica
 * acá en vez de importarlo: son dos módulos de presentación de tabs
 * distintas que no tienen por qué acoplarse por una constante de dos líneas.
 */
export const TIME_PICKER_UPWARD =
  "[&>.absolute]:top-auto [&>.absolute]:bottom-full [&>.absolute]:mt-0 [&>.absolute]:mb-2";
