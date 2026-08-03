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

export const DEFAULT_GOAL_PER_WEEK = 5;

/** Chips de meta semanal: 1 a 7 días. El `id` es el número como string, que es lo que pide `ChipCarousel`. */
export const GOAL_CHIPS: Chip[] = Array.from({ length: 7 }, (_, index) => ({
  id: String(index + 1),
  label: `${index + 1} ${index === 0 ? "día" : "días"}`,
}));
