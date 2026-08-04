import type { NotePriority } from "@/lib/data/home";

/**
 * Constantes de presentación compartidas de la tab Notas: el label, el tono y
 * el papel de cada prioridad (los usan el chip del composer, el badge de la
 * grilla y el detalle), más el ajuste de posición del `TimePicker`.
 */

/**
 * `TimePicker` no expone hacia qué lado abrir su panel: lo posiciona
 * `absolute` sin `top` ni `bottom`, así que siempre cae debajo del input. Y en
 * las dos pantallas donde lo usamos es el último campo del formulario, con lo
 * cual el panel se abre contra el borde de abajo. Estas clases lo dan vuelta
 * apuntando al único hijo directo del componente que es `absolute` — su panel;
 * el resto (label, input, hint) no lo son. Si la librería llega a sumar un
 * prop de posición, esto se borra.
 */
export const TIME_PICKER_UPWARD =
  "[&>.absolute]:top-auto [&>.absolute]:bottom-full [&>.absolute]:mt-0 [&>.absolute]:mb-2";

export const NOTE_PRIORITY_OPTIONS: { value: NotePriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

export const NOTE_PRIORITY_LABEL: Record<NotePriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

/**
 * Papel del post-it de cada prioridad (tokens `--color-note-*`, con su
 * variante oscura en `globals.css`). Clases literales enteras a propósito:
 * Tailwind escanea el fuente como texto, así que un `bg-note-${x}` armado en
 * runtime no genera ninguna de las tres clases.
 */
export const NOTE_PRIORITY_PAPER: Record<NotePriority, string> = {
  low: "bg-note-low",
  medium: "bg-note-medium",
  high: "bg-note-high",
};
