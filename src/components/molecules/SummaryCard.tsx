"use client";

import type { ReactNode } from "react";
import { Card } from "lib-kit-components";
import { ArrowRightIcon } from "@/components/atoms/icons";

/**
 * Tarjeta del dashboard de Inicio: ícono en chip, etiqueta, dato principal y un
 * pie con el último registro. Es `Card variant="glass"` — semitransparente con
 * blur, así que necesita algo de color detrás para leerse como vidrio; el
 * `SummaryPanel` le pone el degradé.
 *
 * La card entera es el link a su tab: el "Ver más" es la señal visual, no un
 * botón aparte (un botón dentro de una card clickeable duplica el target y
 * anida roles interactivos).
 */

export type SummaryTone = "primary" | "accent" | "success" | "danger";

const CHIP: Record<SummaryTone, string> = {
  primary: "bg-primary/12 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
};

const VALUE: Record<SummaryTone, string> = {
  primary: "text-foreground",
  accent: "text-foreground",
  success: "text-success",
  danger: "text-danger",
};

interface SummaryCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  /** Sólo tiñe el dato principal en `success`/`danger` (plata a favor o en contra). */
  tone?: SummaryTone;
  /** Último registro de la sección, a dos líneas como mucho. */
  footnote?: string;
  actionLabel?: string;
  onClick: () => void;
}

export function SummaryCard({
  label,
  value,
  icon,
  tone = "primary",
  footnote,
  actionLabel = "Ver más",
  onClick,
}: SummaryCardProps) {
  return (
    <Card variant="glass" padding="md" onClick={onClick} className="group h-full">
      <div className="flex h-full flex-col gap-2">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${CHIP[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </span>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>

        <p className={`text-xl font-semibold leading-tight ${VALUE[tone]}`}>{value}</p>

        {footnote && (
          <p className="text-xs leading-snug text-muted line-clamp-2">{footnote}</p>
        )}

        {/* mt-auto: el pie queda abajo aunque las cards de la fila tengan
            textos de distinto alto. */}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-muted transition-colors group-hover:text-primary">
          {actionLabel}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Card>
  );
}
