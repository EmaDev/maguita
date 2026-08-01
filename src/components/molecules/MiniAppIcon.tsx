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

/** Chip cuadrado con degradado de marca, el contenedor visual del ícono. */
export function MiniAppBadge({ name }: { name: MiniApp["icon"] }) {
  return (
    <span className="grid place-items-center shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-sm shadow-primary/25">
      <MiniAppIcon name={name} className="w-5 h-5" />
    </span>
  );
}
