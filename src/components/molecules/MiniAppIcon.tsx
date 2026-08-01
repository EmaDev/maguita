import {
  CalculatorIcon,
  ClockIcon,
  GridIcon,
  QrIcon,
  SparkleIcon,
  WalletIcon,
} from "@/components/atoms/icons";
import type { MiniApp } from "@/lib/data/mini-apps";

/**
 * Los datos guardan el nombre del ícono como string (serializable, y así el
 * módulo de datos no importa JSX). Acá se resuelve al componente real.
 */
const ICONS = {
  wallet: WalletIcon,
  qr: QrIcon,
  calculator: CalculatorIcon,
  clock: ClockIcon,
  grid: GridIcon,
  sparkle: SparkleIcon,
} satisfies Record<MiniApp["icon"], unknown>;

export function MiniAppIcon({
  name,
  className = "w-5 h-5",
}: {
  name: MiniApp["icon"];
  className?: string;
}) {
  const Component = ICONS[name] as (props: { className?: string }) => React.ReactElement;
  return <Component className={className} />;
}

/**
 * Tono sólido por categoría, para que la grilla lea como accesos directos de
 * colores distintos (como cualquier launcher) en vez de todas la misma marca.
 * Usa el mismo léxico de tono que `StatCard` (primary/accent/success), pero
 * de fondo lleno en vez de al 10% — acá el color es el protagonista del
 * ícono, no un acento discreto. `danger` queda afuera a propósito: ese tono
 * está reservado para errores/alertas en el resto de la app.
 */
const CATEGORY_TONE_BG: Record<MiniApp["category"], string> = {
  Finanzas: "bg-primary",
  Productividad: "bg-accent",
  Utilidades: "bg-success",
};

/** Chip cuadrado de color sólido por categoría, el contenedor visual del ícono. */
export function MiniAppBadge({ name, category }: { name: MiniApp["icon"]; category: MiniApp["category"] }) {
  return (
    <span
      className={`grid place-items-center shrink-0 w-11 h-11 rounded-2xl text-white shadow-sm shadow-black/10 ${CATEGORY_TONE_BG[category]}`}
    >
      <MiniAppIcon name={name} className="w-5 h-5" />
    </span>
  );
}
