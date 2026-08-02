"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/atoms/icons";

/**
 * Set curado en vez de dejar tipear cualquier cosa: cubre las categorías de
 * gasto más comunes sin necesitar el teclado de emoji nativo del
 * dispositivo/SO (que además varía de soporte entre navegadores).
 */
const EMOJI_OPTIONS = [
  "🍔", "🍕", "☕", "🛒", "🛍️", "👕",
  "🚌", "🚗", "⛽", "✈️", "🏠", "💡",
  "📱", "💳", "🎬", "🎮", "🎵", "📚",
  "💊", "🏥", "🐾", "🎁", "⚽", "🏋️",
  "🧾", "💰", "💼", "🧳", "🎓", "🌴",
  "🔧", "✨",
];

/**
 * Selector de emoji para categorías del gestor de gastos: un botón con el
 * elegido (o un placeholder) que abre una grilla del set curado de arriba.
 * No es un `<input>` de texto — evita depender del teclado de emoji nativo
 * y garantiza que lo guardado sea siempre uno de estos.
 */
interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}

export function EmojiPicker({ value, onChange, disabled, className = "" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={value ? `Emoji elegido: ${value}` : "Elegir emoji"}
        className={[
          "flex h-[52px] w-16 items-center justify-center rounded-xl border-2 bg-surface transition-colors",
          open ? "border-primary" : "border-border hover:border-muted/40",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      >
        {value ? (
          <span className="text-2xl">{value}</span>
        ) : (
          <PlusIcon className="h-5 w-5 text-muted" />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Emojis"
          // `bottom-full` + `mb-1.5` en vez de `top-full`/`mt-1.5`: el picker
          // se usa siempre cerca del fondo de un sheet, donde desplegar hacia
          // abajo lo corta contra el borde inferior.
          className="absolute bottom-full z-30 mb-1.5 grid w-60 grid-cols-6 gap-1 rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/15"
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={emoji === value}
              onClick={() => pick(emoji)}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-surface-alt",
                emoji === value ? "bg-primary/12" : "",
              ].join(" ")}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
